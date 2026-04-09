import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Image proxy route to bypass hotlinking protections
  app.get("/api/proxy-image", async (req, res) => {
    try {
      const imageUrl = req.query.url as string;
      if (!imageUrl) {
        return res.status(400).send("Missing url parameter");
      }

      // Fetch the image from the source
      const response = await fetch(imageUrl, {
        headers: {
          "User-Agent": "node",
          "Accept": "image/webp,image/apng,image/*,*/*;q=0.8",
        },
      });

      if (!response.ok) {
        return res.status(response.status).send(`Failed to fetch image: ${response.statusText}`);
      }

      // Forward the content type
      const contentType = response.headers.get("content-type");
      if (contentType) {
        res.setHeader("Content-Type", contentType);
      }
      
      // Cache control to help the browser
      res.setHeader("Cache-Control", "public, max-age=86400");

      // Convert the response body to a buffer and send it
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      res.send(buffer);
    } catch (error) {
      console.error("Proxy error:", error);
      res.status(500).send("Internal Server Error");
    }
  });

  // API proxy route to bypass CORS/User-Agent blocks for JSON
  app.get("/api/proxy-json", async (req, res) => {
    try {
      const apiUrl = req.query.url as string;
      if (!apiUrl) {
        return res.status(400).send("Missing url parameter");
      }

      const response = await fetch(apiUrl, {
        headers: {
          "User-Agent": "node",
          "Accept": "application/json",
        },
      });

      if (!response.ok) {
        return res.status(response.status).send(`Failed to fetch JSON: ${response.statusText}`);
      }

      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error("JSON Proxy error:", error);
      res.status(500).send("Internal Server Error");
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
