MEDORA COMMUNITY WALL

ADD:
- community.html
- assets/css/community-wall.css
- assets/js/community-wall.js
- assets/js/community-sidebar-patch.js

To add Community to every current sidebar, include before </body>:
<script src="assets/js/community-sidebar-patch.js?v=1"></script>

OPTIONAL on My Day:
<link rel="stylesheet" href="assets/css/myday-community-preview.css?v=1">
<script src="assets/js/myday-community-preview.js?v=1"></script>

Included features:
- For You / Following / Friends / Interests
- Text posts
- Achievements
- Goal updates
- Questions
- Polls
- Like / Comment / Share / Save
- Post privacy: Everyone / Connections / Close friends / Only me
- Comments on/off
- People to connect with
- Trending interests
- Friends' weekly progress

Current storage is localStorage (medora_community_posts_v1), so this works immediately without a database migration.
For real multi-user production, replace storage in community-wall.js with Supabase tables/realtime.
