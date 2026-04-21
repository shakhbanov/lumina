#!/bin/bash
# Post-renewal hook for Let's Encrypt certificates
# Called automatically by certbot after successful renewal

systemctl reload nginx
systemctl restart coturn

echo "[$(date)] Certificates renewed, nginx reloaded, coturn restarted" >> /var/log/lumina/cert-renewal.log
