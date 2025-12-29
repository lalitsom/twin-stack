const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;

    if (pathname === '/api/stacks') {
        const gcpDir = path.join(__dirname, 'assets', 'data', 'gcp');
        fs.readdir(gcpDir, (err, files) => {
            if (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Internal Server Error' }));
                return;
            }

            const stacks = {};
            files.forEach(file => {
                if (file.endsWith('.js')) {
                    const parts = file.replace('.js', '').split('_');
                    const stackName = parts[0];
                    const date = parts[1];
                    if (!stacks[stackName]) {
                        stacks[stackName] = [];
                    }
                    stacks[stackName].push(date);
                }
            });

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(stacks));
        });
    } else if (pathname === '/api/data') {
        const { stack, date } = parsedUrl.query;
        if (!stack || !date) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Missing stack or date parameter' }));
            return;
        }

        const fileName = `${stack}_${date}.js`;
        const filePath = path.join(__dirname, 'assets', 'data', 'gcp', fileName);

        fs.readFile(filePath, 'utf8', (err, data) => {
            if (err) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Data not found' }));
                return;
            }
            res.writeHead(200, { 'Content-Type': 'application/javascript' });
            res.end(data);
        });

    } else {
        const requestedUrl = req.url === '/' ? '/index.html' : req.url;
        const ext = path.extname(requestedUrl).toLowerCase();

        const isAllowed = requestedUrl.startsWith('/assets/') || ext === '.html' || ext === '.ico';

        if (!isAllowed) {
            res.writeHead(403, { 'Content-Type': 'text/plain' });
            res.end('Forbidden');
            return;
        }

        let filePath = path.join(__dirname, requestedUrl);
        const publicDir = path.resolve(__dirname);
        const resolvedPath = path.resolve(filePath);

        if (!resolvedPath.startsWith(publicDir)) {
            res.writeHead(403, { 'Content-Type': 'text/plain' });
            res.end('Forbidden');
            return;
        }

        if (ext === '.html') {
            fs.readFile(filePath, 'utf8', (err, mainData) => {
                if (err) {
                    res.writeHead(404, { 'Content-Type': 'text/plain' });
                    res.end('Not Found');
                    return;
                }
                fs.readFile(path.join(__dirname, 'navbar.html'), 'utf8', (err, navData) => {
                    if (err) {
                        // If navbar.html is missing, just serve the main file
                        res.writeHead(200, { 'Content-Type': 'text/html' });
                        res.end(mainData);
                        return;
                    }
                    const finalHtml = mainData.replace('<div id="navbar-placeholder"></div>', navData);
                    res.writeHead(200, { 'Content-Type': 'text/html' });
                    res.end(finalHtml);
                });
            });
        } else {
            fs.readFile(filePath, (err, data) => {
                if (err) {
                    res.writeHead(404, { 'Content-Type': 'text/plain' });
                    res.end('Not Found');
                } else {
                    const mimeTypes = {
                        '.js': 'application/javascript',
                        '.css': 'text/css',
                        '.json': 'application/json',
                        '.png': 'image/png',
                        '.jpg': 'image/jpeg',
                        '.svg': 'image/svg+xml',
                    };
                    const contentType = mimeTypes[ext] || 'application/octet-stream';

                    res.writeHead(200, { 'Content-Type': contentType });
                    res.end(data);
                }
            });
        }
    }
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
