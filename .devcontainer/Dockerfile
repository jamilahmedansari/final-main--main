# =============================================================================
# Talk-To-My-Lawyer Development Container
# Optimized for Next.js 16 + Supabase + Stripe
# =============================================================================

FROM node:20-bookworm-slim

# Avoid prompts during package installation
ENV DEBIAN_FRONTEND=noninteractive

# Set working directory
WORKDIR /workspace

# Install essential packages and CLIs
RUN apt-get update && apt-get install -y --no-install-recommends \
    # Essential tools
    curl \
    wget \
    git \
    ca-certificates \
    gnupg \
    lsb-release \
    sudo \
    # Build essentials for native modules
    build-essential \
    python3 \
    # Utilities
    vim \
    jq \
    unzip \
    && rm -rf /var/lib/apt/lists/*

# Install GitHub CLI
RUN curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg \
    && chmod go+r /usr/share/keyrings/githubcli-archive-keyring.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | tee /etc/apt/sources.list.d/github-cli.list > /dev/null \
    && apt-get update \
    && apt-get install -y gh \
    && rm -rf /var/lib/apt/lists/*

# Install Supabase CLI (using official install script)
RUN curl -fsSL https://raw.githubusercontent.com/supabase/cli/main/install.sh | sh

# Install Stripe CLI
RUN curl -s https://packages.stripe.dev/api/security/keypair/stripe-cli-gpg/public | gpg --dearmor | tee /usr/share/keyrings/stripe.gpg > /dev/null \
    && echo "deb [signed-by=/usr/share/keyrings/stripe.gpg] https://packages.stripe.dev/stripe-cli-debian-local stable main" | tee /etc/apt/sources.list.d/stripe.list > /dev/null \
    && apt-get update \
    && apt-get install -y stripe \
    && rm -rf /var/lib/apt/lists/*

# Install Docker CLI (for Docker-outside-of-Docker)
RUN curl -fsSL https://download.docker.com/linux/debian/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/debian bookworm stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null \
    && apt-get update \
    && apt-get install -y docker-ce-cli docker-compose-plugin \
    && rm -rf /var/lib/apt/lists/*

# Update npm to latest version
RUN npm install -g npm@latest

# Install pnpm globally
RUN npm install -g pnpm@latest

# Install Vercel CLI
RUN npm install -g vercel@latest

# Install Netlify CLI
RUN npm install -g netlify-cli@latest

# Create non-root user with sudo access and docker group
RUN groupadd -g 999 docker || true \
    && useradd -m -s /bin/bash developer \
    && echo "developer ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers \
    && usermod -aG docker developer

# Set up pnpm store directory
RUN mkdir -p /home/developer/.local/share/pnpm \
    && chown -R developer:developer /home/developer

# Configure shell for developer user
USER developer

# Add shell integration and aliases to bashrc
RUN echo '\n\
# VS Code Shell Integration\n\
if [[ "$TERM_PROGRAM" == "vscode" ]]; then\n\
    if [[ -n "$VSCODE_SHELL_INTEGRATION" ]]; then\n\
        source "$VSCODE_SHELL_INTEGRATION"\n\
    fi\n\
fi\n\
\n\
# Helpful aliases\n\
alias dev="pnpm dev"\n\
alias build="pnpm build"\n\
alias lint="pnpm lint"\n\
alias start="pnpm start"\n\
\n\
# Git branch in prompt\n\
parse_git_branch() {\n\
    git branch 2> /dev/null | sed -e "/^[^*]/d" -e "s/* \(.*\)/ (\1)/"\n\
}\n\
export PS1="\[\033[01;32m\]\u@ttml-dev\[\033[00m\]:\[\033[01;34m\]\w\[\033[33m\]\$(parse_git_branch)\[\033[00m\]\$ "\n\
' >> /home/developer/.bashrc

# Suppress sudo hint
RUN touch /home/developer/.sudo_as_admin_successful

# Set environment variables
ENV NODE_ENV=development
ENV NEXT_TELEMETRY_DISABLED=1
ENV PNPM_HOME=/home/developer/.local/share/pnpm
ENV PATH=$PNPM_HOME:$PATH

WORKDIR /workspace

# Default command
CMD ["bash"]
