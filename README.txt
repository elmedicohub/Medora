MEDORA COMMUNITY — DIRECT SIDEBAR INTEGRATION

This corrected package does NOT rely on JavaScript to make Community appear.

1. Add these files:
   - community.html
   - assets/css/community-wall.css
   - assets/js/community-wall.js

2. In EVERY existing Medora page, replace your current sidebar with:
   - components/medora-sidebar.html

   OR simply add this exact line between People and Progress:

   <a href="community.html"><span>◈</span>Community</a>

3. On community.html the Community item is already present directly in the HTML.

4. No `community-sidebar-patch.js` is required anymore.

The wall contains:
- For You / Following / Friends / Interests
- Create post
- Achievement
- Goal update
- Question
- Poll
- Like
- Comment
- Share
- Save
- Privacy per post
- Comment enable/disable
- Suggested people
- Trending interests

Data is stored locally for now under:
medora_community_posts_v2

This is intentional so the page works immediately without requiring a Supabase migration.
