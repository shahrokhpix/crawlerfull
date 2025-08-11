-- Fix FarsNews selectors
UPDATE news_sources SET 
    list_selector = 'a[href*="/news/"], a.title, .title a, .story-title a',
    title_selector = 'h1, .title, .story-title, .story-head h1',
    content_selector = '.story, .content, .news-content, p'
WHERE name = 'فارس‌نیوز';

-- Show updated selectors
SELECT id, name, list_selector, title_selector, content_selector 
FROM news_sources 
WHERE name = 'فارس‌نیوز'; 