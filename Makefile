.PHONY: install dev dev-fresh build preview clean help

help:
	@echo "Targets:"
	@echo "  make install   Install dependencies"
	@echo "  make dev       Start dev server (http://localhost:4321/Vividice)"
	@echo "  make dev-fresh Clear Astro cache and start dev server"
	@echo "  make build     Build static site to ./dist"
	@echo "  make preview   Serve the built site locally"
	@echo "  make clean     Remove node_modules, dist, .astro"

install:
	npm install

up:
	npm run dev

up-fresh:
	rm -rf .astro node_modules/.astro
	npm run dev

build:
	npm run build

preview: build
	npm run preview

clean:
	rm -rf node_modules dist .astro
