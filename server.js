import 'dotenv/config';
import { createApp } from './src/app.js';

const PORT = process.env.PORT || 8877;

const app = createApp();

app.listen(PORT, () => {
  console.log(`LinkedIn video downloader API running on http://localhost:${PORT}`);
});
