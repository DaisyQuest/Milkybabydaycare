import { createServer } from './src/server.js';

const port = Number.parseInt(process.env.PORT ?? '3000', 10);
const app = createServer();

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Milky Baby Daycare listening on ${port}`);
});
