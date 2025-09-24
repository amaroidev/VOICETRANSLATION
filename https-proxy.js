const https = require('https');
const fs = require('fs');
const path = require('path');
const { createProxyMiddleware } = require('http-proxy-middleware');
const express = require('express');

const app = express();

app.use('/', createProxyMiddleware({
  target: 'http://localhost:8081',
  changeOrigin: true,
  ws: true,
}));

const httpsOptions = {
  key: `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC5/5/5/5/5
-----END PRIVATE KEY-----`,
  cert: `-----BEGIN CERTIFICATE-----
MIIDXTCCAkWgAwIBAgIJAKZ5/5/5/5/5MA0GCSqGSIb3DQEBCwUA
-----END CERTIFICATE-----`
};

const server = https.createServer(httpsOptions, app);

server.listen(8443, () => {
  console.log('HTTPS Proxy running at https://localhost:8443');
  console.log('Proxying to Expo server at http://localhost:8081');
});
