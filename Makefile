SHELL := /bin/bash

.PHONY: help init fmt lint clean up down shell

help: ## Show available targets
	@awk 'BEGIN {FS = ":.*## "}; /^[a-zA-Z0-9_-]+:.*## / {printf "  %-12s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

init: ## Prepare local directories used by the repo
	@mkdir -p .cache/tmp

fmt: ## Format tracked source files when tools are available
	@find . -type f \( -name "*.go" -o -name "*.sh" \) \
		-not -path "./.git/*" \
		-not -path "./vendor/*" | while read -r file; do \
			case "$$file" in \
				*.go) command -v gofmt >/dev/null 2>&1 && gofmt -w "$$file" || true ;; \
				*.sh) command -v shfmt >/dev/null 2>&1 && shfmt -w "$$file" || true ;; \
			esac; \
		done

lint: ## Run lightweight repo checks
	@command -v editorconfig-checker >/dev/null 2>&1 && editorconfig-checker || true
	@command -v shellcheck >/dev/null 2>&1 && find scripts -type f -name "*.sh" -print0 | xargs -0 -r shellcheck || true

clean: ## Remove local cache artifacts
	@rm -rf .cache

up: ## Start the local development workspace
	@docker compose up -d workspace

down: ## Stop the local development workspace
	@docker compose down --remove-orphans

shell: ## Open a shell inside the development workspace
	@docker compose run --rm workspace
