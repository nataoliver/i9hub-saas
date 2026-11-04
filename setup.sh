#!/bin/bash
set -e
echo "=========================================="
echo "  i9Hub SaaS - Deploy Automatizado"
echo "=========================================="
if [ "$EUID" -ne 0 ]; then
  echo "Erro: Execute como root ou com sudo."
  exit 1
fi
echo "[1/5] Atualizando sistema..."
apt update -y && apt upgrade -y
echo "[2/5] Instalando dependencias..."
command -v git >/dev/null || apt install -y git
command -v docker >/dev/null || apt install -y docker.io
(docker compose version >/dev/null 2>&1) || apt install -y docker-compose-plugin
echo "[3/5] Habilitando Docker..."
systemctl enable --now docker
echo "[4/5] Configurando .env..."
if [ ! -f .env ]; then
  if [ -f .env.example ]; then
    cp .env.example .env
    echo ".env criado. Edite-o antes de continuar."
    read -p "Pressione ENTER apos configurar o .env..."
  else
    echo "Erro: .env.example nao encontrado."
    exit 1
  fi
else
  echo ".env ja existe."
fi
echo "[5/5] Subindo stack Docker..."
docker compose down 2>/dev/null || true
docker compose up -d --build
echo "=========================================="
echo "  Deploy concluido!"
echo "=========================================="
docker compose ps