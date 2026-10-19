import { createApp } from './app';

const PORT = Number(process.env.PORT ?? 3001);
const { http } = createApp();
http.listen(PORT, () => console.log(`Fuchs-und-Faser-2-Server auf http://localhost:${PORT}`));
