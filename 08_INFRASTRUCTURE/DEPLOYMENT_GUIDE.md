# Deployment & Release Guide - Elitedom Store

**Document Classification:** Internal  
**Version:** 2.1  
**Status:** Under Review  
**Owner:** Mohamed Anwar  
**Target System:** Elitedom E-Commerce & Odoo ERP Integration (Oracle Cloud Ubuntu VPS & Docker)  

---

## 1. Introduction & Purpose
This deployment guide provides step-by-step instructions for provisioning, configuring, deploying, and officially launching the **Elitedom Store** platform on production servers. It covers infrastructure setup, container orchestration via Docker, SSL certificate provisioning, database initialization, and post-deployment health verification.

---

## 2. Server Provisioning & Prerequisites
- **Cloud Provider:** Oracle Cloud Infrastructure (OCI) running an Ubuntu Linux environment.
- **Administrative Access:** Connect securely via **Termius Pro** using SSH key-based authentication (password login disabled).
- **Required System Packages:**
  ```bash
  sudo apt update && sudo apt upgrade -y
  sudo apt install curl git ufw fail2ban -y
  ```
- **Firewall Configuration (UFW):**
  ```bash
  sudo ufw default deny incoming
  sudo ufw default allow outgoing
  sudo ufw allow ssh
  sudo ufw allow 80/tcp
  sudo ufw allow 443/tcp
  sudo ufw enable
  ```

---

## 3. Docker & Container Arsenal Setup
- **Install Docker Engine & Docker Compose:**
  ```bash
  sudo apt install docker.io docker-compose-v2 -y
  sudo usermod -aG docker $USER
  newgrp docker
  ```
- **Directory Structure:** Create a project directory on the server:
  ```bash
  mkdir -p /opt/elitedom-store/{config,data/odoo,data/postgres,backups}
  cd /opt/elitedom-store
  ```

---

## 4. Environment Configuration & Secrets Management
- **Secrets Retrieval:** Retrieve master database passwords, Stripe API keys, and Odoo admin secrets securely from **1Password**.
- **Create `.env` File:**
  ```env
  POSTGRES_DB=odoo
  POSTGRES_USER=odoo
  POSTGRES_PASSWORD=secure_db_password_from_1password
  HOST=0.0.0.0
  STRIPE_SECRET_KEY=sk_live_...
  HEDERA_OPERATOR_ID=0.0.xxxxxx
  HEDERA_PRIVATE_KEY=302e...
  ```

---

## 5. Deployment via Docker-Compose (`docker-compose.yml`)
Create and execute the master container deployment stack:

```yaml
version: '3.8'

services:
  web:
    image: odoo:17.0
    container_name: elitedom_odoo
    restart: always
    depends_on:
      - db
    environment:
      - HOST=db
      - USER=odoo
      - PASSWORD=secure_db_password_from_1password
    volumes:
      - odoo-web-data:/var/lib/odoo
      - ./config:/etc/odoo
    ports:
      - "8069:8069"

  db:
    image: postgres:15
    container_name: elitedom_postgres
    restart: always
    environment:
      - POSTGRES_DB=odoo
      - POSTGRES_USER=odoo
      - POSTGRES_PASSWORD=secure_db_password_from_1password
    volumes:
      - postgres-data:/var/lib/postgresql/data

  nginx-proxy-manager:
    image: jc21/nginx-proxy-manager:latest
    container_name: elitedom_npm
    restart: always
    ports:
      - "80:80"
      - "443:443"
      - "81:81"
    volumes:
      - ./data/npm:/data
      - ./data/letsencrypt:/etc/letsencrypt

  portainer:
    image: portainer/portainer-ce:latest
    container_name: elitedom_portainer
    restart: always
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - ./data/portainer:/data
    ports:
      - "9000:9000"

  duplicati:
    image: linuxserver/duplicati:latest
    container_name: elitedom_duplicati
    restart: always
    environment:
      - PUID=1000
      - PGID=1000
    volumes:
      - ./backups:/backups
      - /opt/elitedom-store:/source
    ports:
      - "8200:8200"

volumes:
  odoo-web-data:
  postgres-data:
```

Run containers in detached mode:
```bash
docker compose up -d
```

---

## 6. SSL & Domain Configuration (NameSSL & Let's Encrypt)
1. Point domain `elitedom.store` and `api.elitedom.store` to the Oracle Cloud VPS public IP via DNS records.
2. Access Nginx Proxy Manager GUI at `http://<VPS_IP>:81`.
3. Configure Proxy Host for `elitedom.store` pointing to container `elitedom_odoo` on port `8069`.
4. Request and issue an automated **Let's Encrypt SSL certificate** via NameSSL integration to enforce HTTPS.

---

## 7. Third-Party Integrations & Post-Launch Verification
- **Stripe Webhooks:** Configure Stripe dashboard endpoint to point to `https://api.elitedom.store/v1/webhooks/stripe`.
- **Hedera Audit Script:** Deploy the Python script to hash transactions onto the Hedera network.
- **Monitoring & Sentry:** Verify that **DataDog** agent is reporting container metrics and **Sentry** SDK is capturing error traces inside Odoo.

---
**End of Document**
