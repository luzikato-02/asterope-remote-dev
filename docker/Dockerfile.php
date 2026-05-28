FROM asterope/base:latest

USER root

# PHP 8.3 is in Ubuntu 24.04 main repos — no PPA required
RUN apt-get update && apt-get install -y --no-install-recommends \
    php8.3-cli \
    php8.3-fpm \
    php8.3-curl \
    php8.3-gd \
    php8.3-intl \
    php8.3-mbstring \
    php8.3-mysql \
    php8.3-pgsql \
    php8.3-sqlite3 \
    php8.3-xml \
    php8.3-zip \
    php8.3-bcmath \
    php8.3-xdebug \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Composer 2
RUN curl -sS https://getcomposer.org/installer \
    | php -- --install-dir=/usr/local/bin --filename=composer

USER coder
