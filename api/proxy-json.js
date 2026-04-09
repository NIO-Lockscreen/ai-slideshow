export default async function handler(req, res) {
  const { url } = req.query;
  if (!url) {
    return res.status(400).send("Missing url parameter");
  }

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "node",
        "Accept": "application/json",
      },
    });

    if (!response.ok) {
      return res.status(response.status).send(`Failed to fetch JSON: ${response.statusText}`);
    }

    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    console.error("JSON Proxy error:", error);
    res.status(500).send("Internal Server Error");
  }
}
