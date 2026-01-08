import type { LedgerConfig } from './config';
import { createConfig, createJwtToken } from './config';
import { getPackageResolver } from './resolver';
import type { Party, Numeric, DamlMap, Optional } from '../core/primitives';
import type { InstrumentKey, AccountKey, Lock } from '../core/interfaces';

export interface ArchivedHolding {
  contractId: string;
  templateId: string;
  payload: HoldingPayload;
  archivedAt: string;
  archivedInTransaction: string;
  createdAt?: string;
}

export interface HoldingPayload {
  instrument: InstrumentKey;
  account: AccountKey;
  amount: Numeric;
  lock: Optional<Lock>;
  observers: DamlMap<string, Party[]>;
}

interface CreatedEvent {
  contractId: string;
  templateId: string;
  payload: HoldingPayload;
  createdAt?: string;
}

interface UpdateEvent {
  transactionId: string;
  offset: string;
  effectiveAt: string;
  events: Array<{
    created?: CreatedEvent;
    archived?: { contractId: string; templateId: string };
  }>;
}

type IndexChangeCallback = (archived: ArchivedHolding[], active: Map<string, CreatedEvent>) => void;

const HOLDING_TEMPLATE_PATTERNS = [
  'Daml.Finance.Holding',
  'BaseHolding',
  'Fungible',
  'Transferable',
  'TransferableFungible',
];

function isHoldingTemplate(templateId: string): boolean {
  return HOLDING_TEMPLATE_PATTERNS.some(pattern => templateId.includes(pattern));
}

export class HoldingsArchiveIndex {
  private archived: Map<string, ArchivedHolding> = new Map();
  private active: Map<string, CreatedEvent> = new Map();
  private lastOffset: string = '';
  private isStreaming: boolean = false;
  private abortController: AbortController | null = null;
  private config: LedgerConfig;
  private party: Party;
  private onChange: IndexChangeCallback | null = null;

  constructor(party: Party, config?: Partial<LedgerConfig>) {
    this.party = party;
    this.config = createConfig(config);
  }

  getArchivedHoldings(): ArchivedHolding[] {
    return Array.from(this.archived.values());
  }

  getActiveHoldings(): CreatedEvent[] {
    return Array.from(this.active.values());
  }

  getArchivedByContractId(contractId: string): ArchivedHolding | undefined {
    return this.archived.get(contractId);
  }

  getLastOffset(): string {
    return this.lastOffset;
  }

  isRunning(): boolean {
    return this.isStreaming;
  }

  onIndexChange(callback: IndexChangeCallback): void {
    this.onChange = callback;
  }

  private notifyChange(): void {
    if (this.onChange) {
      this.onChange(this.getArchivedHoldings(), this.active);
    }
  }

  async startFromBeginning(): Promise<void> {
    return this.start('000000000000000000');
  }

  async start(beginOffset: string = '000000000000000000'): Promise<void> {
    if (this.isStreaming) {
      console.warn('HoldingsArchiveIndex: Already streaming');
      return;
    }

    this.isStreaming = true;
    this.abortController = new AbortController();

    console.log(`HoldingsArchiveIndex: Starting from offset ${beginOffset}`);

    const isBrowser = typeof window !== 'undefined';
    
    if (isBrowser) {
      console.log('HoldingsArchiveIndex: Running in browser, using JSON API streaming');
      await this.fallbackToJsonApiPolling(beginOffset);
      return;
    }

    const grpcPort = this.config.port === 7575 ? 5061 : this.config.port;
    const grpcHost = this.config.host;
    
    console.log(`HoldingsArchiveIndex: Connecting to gRPC at ${grpcHost}:${grpcPort}`);

    try {
      await this.streamUpdatesGrpc(grpcHost, grpcPort, beginOffset);
    } catch (error) {
      console.error('HoldingsArchiveIndex: gRPC streaming failed, falling back to JSON API polling');
      await this.fallbackToJsonApiPolling(beginOffset);
    }
  }

  stop(): void {
    this.isStreaming = false;
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    console.log('HoldingsArchiveIndex: Stopped');
  }

  private async streamUpdatesGrpc(host: string, port: number, beginOffset: string): Promise<void> {
    let grpc: typeof import('@grpc/grpc-js');
    let protoLoader: typeof import('@grpc/proto-loader');
    
    try {
      grpc = await import('@grpc/grpc-js');
      protoLoader = await import('@grpc/proto-loader');
    } catch {
      throw new Error('gRPC dependencies not installed. Run: npm install @grpc/grpc-js @grpc/proto-loader');
    }

    const PROTO_PATH = await this.getProtoPath();
    
    const packageDefinition = await protoLoader.load(PROTO_PATH, {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
    });

    const protoDescriptor = grpc.loadPackageDefinition(packageDefinition);
    const updateService = (protoDescriptor.com as any)?.daml?.ledger?.api?.v2?.UpdateService;

    if (!updateService) {
      throw new Error('UpdateService not found in proto definition');
    }

    const client = new updateService(
      `${host}:${port}`,
      grpc.credentials.createInsecure()
    );

    const token = this.config.token || createJwtToken(this.party, {
      ledgerId: this.config.ledgerId,
      applicationId: this.config.applicationId,
    });

    const metadata = new grpc.Metadata();
    metadata.add('authorization', `Bearer ${token}`);

    const request = {
      begin_exclusive: { absolute: beginOffset },
      filter: {
        filters_by_party: {
          [this.party]: {
            cumulative: {
              template_filters: [],
              interface_filters: [],
            }
          }
        }
      },
      verbose: true,
    };

    return new Promise((resolve, reject) => {
      const stream = client.GetUpdates(request, metadata);

      stream.on('data', (response: any) => {
        if (!this.isStreaming) {
          stream.cancel();
          return;
        }

        if (response.transaction) {
          this.processTransaction(response.transaction);
        }
        
        if (response.offset) {
          this.lastOffset = response.offset;
        }
      });

      stream.on('error', (err: Error) => {
        if (this.isStreaming) {
          console.error('HoldingsArchiveIndex: Stream error:', err.message);
          reject(err);
        }
      });

      stream.on('end', () => {
        console.log('HoldingsArchiveIndex: Stream ended');
        resolve();
      });
    });
  }

  private async getProtoPath(): Promise<string> {
    const path = await import('path');
    const fs = await import('fs');
    
    const possiblePaths = [
      path.join(process.cwd(), 'protos', 'com', 'daml', 'ledger', 'api', 'v2', 'update_service.proto'),
      path.join(__dirname, '..', '..', 'protos', 'com', 'daml', 'ledger', 'api', 'v2', 'update_service.proto'),
      '/usr/local/share/daml/protos/com/daml/ledger/api/v2/update_service.proto',
    ];

    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        return p;
      }
    }

    throw new Error(
      'Ledger API proto files not found. Please download from: ' +
      'https://github.com/digital-asset/daml/tree/main/sdk/ledger-api/grpc-definitions'
    );
  }

  private processTransaction(transaction: any): void {
    const events = transaction.events || [];
    const transactionId = transaction.update_id || transaction.transaction_id || '';
    const effectiveAt = transaction.effective_at || new Date().toISOString();

    for (const event of events) {
      if (event.created) {
        const created = event.created;
        const templateId = this.formatTemplateId(created.template_id);
        
        if (isHoldingTemplate(templateId)) {
          const contractId = created.contract_id;
          this.active.set(contractId, {
            contractId,
            templateId,
            payload: this.parsePayload(created.create_arguments),
            createdAt: effectiveAt,
          });
        }
      }

      if (event.archived) {
        const archived = event.archived;
        const templateId = this.formatTemplateId(archived.template_id);
        
        if (isHoldingTemplate(templateId)) {
          const contractId = archived.contract_id;
          const activeContract = this.active.get(contractId);
          
          if (activeContract) {
            this.archived.set(contractId, {
              contractId,
              templateId,
              payload: activeContract.payload,
              archivedAt: effectiveAt,
              archivedInTransaction: transactionId,
              createdAt: activeContract.createdAt,
            });
            this.active.delete(contractId);
            this.notifyChange();
          } else {
            this.archived.set(contractId, {
              contractId,
              templateId,
              payload: {} as HoldingPayload,
              archivedAt: effectiveAt,
              archivedInTransaction: transactionId,
            });
            this.notifyChange();
          }
        }
      }
    }
  }

  private formatTemplateId(templateId: any): string {
    if (typeof templateId === 'string') return templateId;
    if (templateId?.package_id && templateId?.module_name && templateId?.entity_name) {
      return `${templateId.package_id}:${templateId.module_name}:${templateId.entity_name}`;
    }
    return JSON.stringify(templateId);
  }

  private parsePayload(args: any): HoldingPayload {
    if (!args) return {} as HoldingPayload;
    
    const fields = args.fields || args.record?.fields || [];
    const result: Record<string, any> = {};
    
    for (const field of fields) {
      const label = field.label;
      const value = this.extractValue(field.value);
      result[label] = value;
    }

    return result as HoldingPayload;
  }

  private extractValue(value: any): any {
    if (!value) return null;
    
    if (value.text !== undefined) return value.text;
    if (value.int64 !== undefined) return value.int64;
    if (value.numeric !== undefined) return value.numeric;
    if (value.bool !== undefined) return value.bool;
    if (value.party !== undefined) return value.party;
    if (value.contract_id !== undefined) return value.contract_id;
    if (value.timestamp !== undefined) return value.timestamp;
    if (value.date !== undefined) return value.date;
    if (value.unit !== undefined) return {};
    if (value.optional) {
      return value.optional.value ? this.extractValue(value.optional.value) : null;
    }
    if (value.list) {
      return (value.list.elements || []).map((e: any) => this.extractValue(e));
    }
    if (value.map) {
      const entries = value.map.entries || [];
      return entries.map((e: any) => [e.key, this.extractValue(e.value)]);
    }
    if (value.record) {
      return this.parsePayload(value.record);
    }
    if (value.variant) {
      return { tag: value.variant.constructor, value: this.extractValue(value.variant.value) };
    }
    if (value.enum) {
      return value.enum.constructor;
    }
    
    return value;
  }

  private async fallbackToJsonApiPolling(beginOffset: string): Promise<void> {
    console.log('HoldingsArchiveIndex: Using JSON API streaming (SSE)');
    console.log('HoldingsArchiveIndex: Note - JSON API streams live updates only, not historical data');

    let baseUrl = this.config.ledgerUrl !== undefined 
      ? this.config.ledgerUrl 
      : `http://${this.config.host}:${this.config.port}`;
    if (baseUrl === '/') {
      baseUrl = '';
    }

    const token = this.config.token || createJwtToken(this.party, {
      ledgerId: this.config.ledgerId,
      applicationId: this.config.applicationId,
    });
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    };

    const holdingTemplateIds = [
      'daml-finance-holding-v4:Daml.Finance.Holding.V4.TransferableFungible:TransferableFungible',
      'daml-finance-holding-v4:Daml.Finance.Holding.V4.Fungible:Fungible',
      'daml-finance-holding-v4:Daml.Finance.Holding.V4.Transferable:Transferable',
      'daml-finance-holding-v4:Daml.Finance.Holding.V4.BaseHolding:BaseHolding',
    ];

    console.log('HoldingsArchiveIndex: Resolving template IDs to package hashes...');
    const resolver = getPackageResolver();
    const resolvedTemplateIds: string[] = [];
    
    for (const templateId of holdingTemplateIds) {
      try {
        const resolved = await resolver.resolveTemplateId(templateId, baseUrl, headers);
        resolvedTemplateIds.push(resolved);
        console.log(`HoldingsArchiveIndex: Resolved ${templateId.split(':')[2]}`);
      } catch (err) {
        console.warn(`HoldingsArchiveIndex: Could not resolve ${templateId}, skipping`);
      }
    }

    if (resolvedTemplateIds.length === 0) {
      throw new Error('Could not resolve any holding template IDs. Is the ledger running with Daml Finance packages?');
    }

    const wsUrl = `ws://${this.config.host || 'localhost'}:${this.config.port || 7575}/v1/stream/query`;
    console.log('HoldingsArchiveIndex: Connecting WebSocket to:', wsUrl);

    return new Promise((resolve, reject) => {
      const ws = new WebSocket(wsUrl, [`jwt.token.${token}`, `daml.ws.auth`]);
      
      let connected = false;

      const cleanup = () => {
        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
          ws.close();
        }
      };

      if (this.abortController) {
        this.abortController.signal.addEventListener('abort', cleanup);
      }

      ws.onopen = () => {
        console.log('HoldingsArchiveIndex: WebSocket connected, sending query...');
        connected = true;
        const query = { templateIds: resolvedTemplateIds };
        console.log('HoldingsArchiveIndex: Sending query:', JSON.stringify(query));
        ws.send(JSON.stringify(query));
      };

      ws.onmessage = (event) => {
        console.log('HoldingsArchiveIndex: Received message:', event.data.substring(0, 200));
        
        if (!this.isStreaming) {
          cleanup();
          resolve();
          return;
        }

        try {
          const data = JSON.parse(event.data);
          
          if (data.heartbeat) {
            console.log('HoldingsArchiveIndex: Heartbeat received');
            return;
          }
          
          if (data.warnings) {
            console.warn('HoldingsArchiveIndex: Server warnings:', data.warnings);
          }
          
          if (data.errors) {
            console.error('HoldingsArchiveIndex: Server error:', data.errors);
            return;
          }

          if (data.events) {
            console.log('HoldingsArchiveIndex: Received events:', data.events.length);
          }

          this.processJsonApiEvent(data);
        } catch (err) {
          console.error('HoldingsArchiveIndex: Failed to parse message:', err, event.data);
        }
      };

      ws.onerror = (err) => {
        console.error('HoldingsArchiveIndex: WebSocket error');
        if (!connected && this.isStreaming) {
          reject(new Error('WebSocket connection failed. Make sure the ledger is running.'));
        }
      };

      ws.onclose = (event) => {
        console.log('HoldingsArchiveIndex: WebSocket closed', event.code, event.reason);
        if (this.isStreaming && !connected) {
          reject(new Error(`WebSocket connection closed: ${event.code} ${event.reason}`));
        } else {
          resolve();
        }
      };
    });
  }

  private processJsonApiEvent(data: any): void {
    if (data.events) {
      for (const event of data.events) {
        if (event.created) {
          const created = event.created;
          if (isHoldingTemplate(created.templateId)) {
            this.active.set(created.contractId, {
              contractId: created.contractId,
              templateId: created.templateId,
              payload: created.payload,
              createdAt: new Date().toISOString(),
            });
          }
        }
        
        if (event.archived) {
          const archived = event.archived;
          if (isHoldingTemplate(archived.templateId)) {
            const activeContract = this.active.get(archived.contractId);
            
            if (activeContract) {
              this.archived.set(archived.contractId, {
                contractId: archived.contractId,
                templateId: archived.templateId,
                payload: activeContract.payload,
                archivedAt: new Date().toISOString(),
                archivedInTransaction: data.transactionId || '',
                createdAt: activeContract.createdAt,
              });
              this.active.delete(archived.contractId);
              this.notifyChange();
            }
          }
        }
      }
    }

    if (data.offset) {
      this.lastOffset = data.offset;
    }
  }

  toJSON(): { archived: ArchivedHolding[]; lastOffset: string } {
    return {
      archived: this.getArchivedHoldings(),
      lastOffset: this.lastOffset,
    };
  }

  fromJSON(data: { archived: ArchivedHolding[]; lastOffset: string }): void {
    this.archived.clear();
    for (const holding of data.archived) {
      this.archived.set(holding.contractId, holding);
    }
    this.lastOffset = data.lastOffset;
  }
}

export function createHoldingsArchiveIndex(
  party: Party,
  config?: Partial<LedgerConfig>
): HoldingsArchiveIndex {
  return new HoldingsArchiveIndex(party, config);
}

