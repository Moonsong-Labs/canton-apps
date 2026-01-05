.PHONY: setup deps build webapp-deps

setup: deps build webapp-deps
	@echo "Setup complete!"

deps:
	@echo "Downloading Daml Finance dependencies..."
	./get-dependencies.sh

build:
	@echo "Building all Daml packages..."
	daml build --all

webapp-deps:
	@echo "Installing webapp dependencies..."
	cd vault/webapp && bun i

