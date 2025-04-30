const express = require("express");
const puppeteer = require("puppeteer");

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/api/farsnews", async (req, res) => {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  const page = await browser.newPage();
  await page.goto("https://www.farsnews.ir/Sports/showcase", { waitUntil: "networkidle2" });

  const articles = await page.$$eval("article", (nodes) =>
    nodes.map((node) => {
      try {
        const linkEl = node.querySelector("a[href^='/news']");
        const titleEl = node.querySelector(".news-title");
        const viewEl = node.querySelector("span.text-black");
        const timeEl = node.querySelector("time");

        return {
          title: titleEl?.innerText?.trim(),
          link: linkEl ? "https://www.farsnews.ir" + linkEl.getAttribute("href") : null,
          viewCount: viewEl ? parseInt(viewEl.innerText.trim()) : 0,
          publishedOn: timeEl?.getAttribute("datetime")
        };
      } catch (e) {
        return null;
      }
    }).filter(x => x && x.title && x.link)
  );

  await browser.close();
  res.json(articles);
});

app.listen(PORT, () => {
  console.log(`🚀 Server ready at http://localhost:${PORT}`);
});
