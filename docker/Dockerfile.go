FROM asterope/base:latest

USER root

ARG GO_VERSION=1.22.4

RUN curl -sL "https://go.dev/dl/go${GO_VERSION}.linux-amd64.tar.gz" \
    | tar -C /usr/local -xzf -

ENV PATH="${PATH}:/usr/local/go/bin"
ENV GOPATH="/home/coder/go"
ENV GOBIN="/home/coder/go/bin"

RUN mkdir -p /home/coder/go && chown -R coder:coder /home/coder/go

USER coder
