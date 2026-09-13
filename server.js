const express = require('express');
const path = require('path');

const app = express();
const PORT = 3000;
const HOST = '0.0.0.0';

// Serve static assets from the project root directory
app.use(express.static(path.join(__dirname)));

// Fallback to index.html for SPA/client-side routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, HOST, () => {
  console.log(`RecipeOps server running at http://${HOST}:${PORT}`);
});
