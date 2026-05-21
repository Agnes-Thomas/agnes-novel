# Agnes Thomas — Novel CMS

A live, dynamic serialized novel website with full Author CMS.

## Deploy to Railway (5 minutes, no terminal)

1. **Push this folder to GitHub**
   - Go to github.com → New repository → name it `agnes-novel`
   - Upload all these files (drag & drop)

2. **Deploy on Railway**
   - Go to railway.app → Login with GitHub
   - Click "New Project" → "Deploy from GitHub repo"
   - Select your `agnes-novel` repository
   - Railway auto-detects Node.js and deploys it

3. **Set environment variables** (in Railway dashboard → Variables tab)
   ```
   CMS_PASSWORD   = your_strong_password_here
   JWT_SECRET     = any_long_random_string_64_chars
   NODE_ENV       = production
   ```

4. **Your site is live!**
   - Railway gives you a URL like: `https://agnes-novel-production.up.railway.app`
   - Public site: that URL
   - Author CMS: that URL + `/admin`

## Default CMS password
`novel123` — change it immediately in the Railway Variables tab as `CMS_PASSWORD`

## Features
- Public novel site with Table of Contents
- Copyright section (Agnes Thomas, auto-updating year)
- Chapter reader with prev/next navigation
- Author CMS: write, paste, or upload .txt/.docx chapters
- Rich text editor: fonts, sizes, colours, formatting
- SEO: JSON-LD (Book + Chapter schemas), Open Graph, sitemap.xml, robots.txt
- All chapters stored in a real database on Railway's servers
