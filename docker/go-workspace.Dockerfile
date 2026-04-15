FROM golang:1.25-bookworm

RUN apt-get update \
  && apt-get install -y --no-install-recommends bash ca-certificates curl git make openssh-client \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /workspace
