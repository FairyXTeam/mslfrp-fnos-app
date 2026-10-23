#!/bin/bash
# MSL FRP fnOS CGI Dispatcher
export PATH=/var/apps/nodejs_v22/target/bin:/usr/local/bin:/usr/bin:$PATH

APP_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
SOCKET_PATH="${APP_DIR}/app.sock"

# If node is available, invoke cgi_handler.js
if command -v node >/dev/null 2>&1; then
    exec node "${APP_DIR}/app/server/cgiHandler.js"
fi

# Fallback basic response if node is not found
echo "Status: 500 Internal Server Error"
echo "Content-Type: text/plain; charset=utf-8"
echo ""
echo "Node.js environment not found. Please install nodejs_v22 package on fnOS."
exit 0
