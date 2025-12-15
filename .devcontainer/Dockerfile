# =============================================================================
# Talk-To-My-Lawyer Development Container
# Optimized for Next.js 16 + Supabase + Stripe
# =============================================================================

FROM node:22.21.1-slim

ENV DEBIAN_FRONTEND=noninteractive

# -----------------------------
# Base packages
# -----------------------------
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    wget \
    git \
    ca-certificates \
    gnupg \
    lsb-release \
    sudo \
    build-essential \
    python3 \
    vim \
    jq \
    unzip \
    && rm -rf /var/lib/apt/lists/*

# -----------------------------
# Docker CLI + Compose plugin (single install)
# -----------------------------
RUN install -m 0755 -d /etc/apt/keyrings \
    && curl -fsSL https://download.docker.com/linux/debian/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg \
    && chmod a+r /etc/apt/keyrings/docker.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/debian bookworm stable" \
        > /etc/apt/sources.list.d/docker.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends docker-ce-cli docker-compose-plugin \
    && rm -rf /var/lib/apt/lists/*

# -----------------------------
# GitHub CLI
# -----------------------------
RUN curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
      | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg \
    && chmod go+r /usr/share/keyrings/githubcli-archive-keyring.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
      > /etc/apt/sources.list.d/github-cli.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends gh \
    && rm -rf /var/lib/apt/lists/*

# -----------------------------
# Supabase CLI
# -----------------------------
RUN curl -fsSL https://raw.githubusercontent.com/supabase/cli/main/install.sh | sh

# -----------------------------
# Stripe CLI
# -----------------------------
RUN curl -s https://packages.stripe.dev/api/security/keypair/stripe-cli-gpg/public \
      | gpg --dearmor \
      | tee /usr/share/keyrings/stripe.gpg > /dev/null \
    && echo "deb [signed-by=/usr/share/keyrings/stripe.gpg] https://packages.stripe.dev/stripe-cli-debian-local stable main" \
      > /etc/apt/sources.list.d/stripe.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends stripe \
    && rm -rf /var/lib/apt/lists/*

# -----------------------------
# Node tooling
# -----------------------------
RUN npm install -g npm@latest pnpm@latest vercel@latest netlify-cli@latest

# -----------------------------
# Use the built-in `node` user
# IMPORTANT: Make /workspace writable by node
# -----------------------------
RUN mkdir -p /workspace \
  && chown -R node:node /workspace \
  && mkdir -p /home/node/.local/share/pnpm \
  && chown -R node:node /home/node/.local \
  && echo "node ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/node \
  && chmod 0440 /etc/sudoers.d/node

# Environment
ENV NODE_ENV=development
ENV NEXT_TELEMETRY_DISABLED=1
ENV PNPM_HOME=/home/node/.local/share/pnpm
ENV PATH=$PNPM_HOME:$PATH

# Switch to node
USER node
WORKDIR /workspace

# Nice prompt + aliases (optional but handy)
RUN echo '\n\
alias dev="pnpm dev"\n\
alias build="pnpm build"\n\
alias lint="pnpm lint"\n\
alias start="pnpm start"\n\
export HISTFILE=/home/node/bash_history_vol/.bash_history\n\
' >> /home/node/.bashrc \
  && mkdir -p /home/node/bash_history_vol \
  && touch /home/node/.sudo_as_admin_successful

CMD ["bash"]