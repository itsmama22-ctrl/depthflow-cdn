import fs from 'node:fs/promises';
import path from 'node:path';

const PIXABAY_KEY = process.env.PIXABAY_API_KEY;
const UNSPLASH_KEY = process.env.UNSPLASH_ACCESS_KEY;
const CDN_BASE = 'https://cdn.jsdelivr.net/gh/itsmama22-ctrl/depthflow-cdn@main/v1';

const BLOCKED_WORDS = [
  'mockup', 'smartphone', 'iphone', 'laptop', 'desk',
  'office', 'handshake', 'selfie', 'logo', 'watermark'
];

const CATEGORIES = [
  {
    id: 'spatial',
    name: 'Spatial 3D',
    unsplash: 'https://api.unsplash.com/topics/3d-renders/photos?orientation=portrait&content_filter=high&per_page=30',
    pixabayImg: 'q=3d+render+abstract&image_type=illustration',
    pixabayVid: 'q=3d+abstract+loop&video_type=animation'
  },
  {
    id: 'abstract',
    name: 'Liquid & Fluid',
    unsplash: 'https://api.unsplash.com/search/photos?query=liquid+abstract+gradient&orientation=portrait&content_filter=high&per_page=30',
    pixabayImg: 'q=fluid+art+abstract&category=backgrounds&image_type=all',
    pixabayVid: 'q=liquid+abstract+waves&video_type=animation'
  },
  {
    id: 'cyberpunk',
    name: 'Neon Cyber',
    unsplash: 'https://api.unsplash.com/search/photos?query=tokyo+neon+night+rain&orientation=portrait&content_filter=high&per_page=30',
    pixabayImg: 'q=cyberpunk+neon+city&image_type=illustration',
    pixabayVid: 'q=cyberpunk+neon+tunnel&video_type=animation'
  },
  {
    id: 'oled',
    name: 'AMOLED Dark',
    unsplash: 'https://api.unsplash.com/search/photos?query=black+minimal+texture&color=black&orientation=portrait&content_filter=high&per_page=30',
    pixabayImg: 'q=black+minimal+dark&colors=black&category=backgrounds',
    pixabayVid: 'q=dark+particles+glow&video_type=animation'
  },
  {
    id: 'cosmos',
    name: 'Deep Space',
    unsplash: 'https://api.unsplash.com/search/photos?query=nebula+galaxy+milky+way&color=black&orientation=portrait&content_filter=high&per_page=30',
    pixabayImg: 'q=nebula+galaxy+cosmos&category=science&image_type=all',
    pixabayVid: 'q=galaxy+stars+nebula&video_type=animation'
  },
  {
    id: 'architecture',
    name: 'Urban Geometry',
    unsplash: 'https://api.unsplash.com/search/photos?query=minimalist+architecture+building+sky&orientation=portrait&content_filter=high&per_page=30',
    pixabayImg: 'q=modern+architecture+geometry&category=buildings&image_type=photo',
    pixabayVid: 'q=city+timelapse+night&video_type=film'
  },
  {
    id: 'landscapes',
    name: 'Scenic Depth',
    unsplash: 'https://api.unsplash.com/search/photos?query=moody+mountain+peak+fog&orientation=portrait&content_filter=high&per_page=30',
    pixabayImg: 'q=misty+mountain+landscape&category=nature&image_type=photo',
    pixabayVid: 'q=mountain+clouds+timelapse&video_type=film'
  },
  {
    id: 'anime',
    name: 'Anime & Sci-Fi',
    unsplash: 'https://api.unsplash.com/search/photos?query=futuristic+sci+fi+architecture&orientation=portrait&content_filter=high&per_page=30',
    pixabayImg: 'q=anime+scenery+night&image_type=illustration',
    pixabayVid: 'q=sci+fi+futuristic+loop&video_type=animation'
  }
];

function isCleanText(text = '') {
  const lower = text.toLowerCase();
  return !BLOCKED_WORDS.some((word) => lower.includes(word));
}

async function fetchUnsplash(url) {
  if (!UNSPLASH_KEY) return [];
  const res = await fetch(url, {
    headers: {
      Authorization: `Client-ID ${UNSPLASH_KEY}`,
      'Accept-Version': 'v1'
    }
  });
  if (!res.ok) return [];
  const data = await res.json();
  const list = Array.isArray(data) ? data : (data.results || []);

  return list
    .filter((p) => {
      if (!p.width || !p.height) return false;
      if (p.height / p.width < 1.4 || p.height < 1920) return false;
      return isCleanText(`${p.description || ''} ${p.alt_description || ''}`);
    })
    .map((p) => ({
      id: `un_${p.id}`,
      title: (p.alt_description || p.description || '4K Spatial Art').slice(0, 48),
      isDepthReady: true,
      isPro: false,
      dominantHex: p.color || '#0B0D12',
      thumbUrl: p.urls.small,
      fullUrl: p.urls.regular,
      photographer: p.user?.name || 'Unsplash Creator',
      photographerURL: `${p.user?.links?.html || 'https://unsplash.com'}?utm_source=depthflow&utm_medium=referral`,
      unsplashPhotoId: p.id
    }));
}

async function fetchPixabayImages(queryParams) {
  if (!PIXABAY_KEY) return [];
  const base = `https://pixabay.com/api/?key=${PIXABAY_KEY}&${queryParams}&orientation=vertical&safesearch=true&min_height=1920&order=popular&per_page=30`;
  let res = await fetch(`${base}&editors_choice=true`);
  let data = res.ok ? await res.json() : { hits: [] };

  if (!data.hits || data.hits.length < 10) {
    res = await fetch(`${base}&editors_choice=false`);
    data = res.ok ? await res.json() : { hits: [] };
  }

  return (data.hits || [])
    .filter((h) => h.imageHeight / h.imageWidth >= 1.4 && isCleanText(h.tags))
    .map((h) => ({
      id: `px_${h.id}`,
      title: (h.tags?.split(',')[0] || '4K Wallpaper').trim(),
      isDepthReady: true,
      isPro: false,
      dominantHex: '#10131A',
      thumbUrl: h.webformatURL,
      fullUrl: h.largeImageURL,
      photographer: h.user || 'Pixabay Artist',
      photographerURL: h.pageURL
    }));
}

async function fetchPixabayVideos(queryParams) {
  if (!PIXABAY_KEY) return [];
  const url = `https://pixabay.com/api/videos/?key=${PIXABAY_KEY}&${queryParams}&orientation=vertical&safesearch=true&order=popular&per_page=20`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();

  return (data.hits || [])
    .filter((v) => {
      const vid = v.videos?.large || v.videos?.medium;
      if (!vid || !vid.url) return false;
      if (vid.height < vid.width) return false;
      return v.duration >= 3 && v.duration <= 15 && isCleanText(v.tags);
    })
    .map((v) => {
      const vid = v.videos?.large || v.videos?.medium;
      const thumb =
        v.videos?.medium?.thumbnail ||
        v.videos?.tiny?.thumbnail ||
        `https://i.vimeocdn.com/video/${v.picture_id}_640x360.jpg`;
      return {
        id: `pxv_${v.id}`,
        title: `${(v.tags?.split(',')[0] || 'Live Motion').trim()} Live`,
        isDepthReady: true,
        isPro: false,
        dominantHex: '#0B0D12',
        thumbUrl: thumb,
        fullUrl: thumb,
        liveVideoUrl: vid.url,
        photographer: v.user || 'Pixabay Creator',
        photographerURL: v.pageURL
      };
    });
}

async function main() {
  await fs.mkdir('v1/categories', { recursive: true });
  const updatedAt = new Date().toISOString();

  for (const cat of CATEGORIES) {
    const [videos, unsplashPhotos, pixabayPhotos] = await Promise.all([
      fetchPixabayVideos(cat.pixabayVid),
      fetchUnsplash(cat.unsplash),
      fetchPixabayImages(cat.pixabayImg)
    ]);

    // Interleave live videos, Unsplash, and Pixabay so each tab feels rich & varied
    const items = [];
    const maxLen = Math.max(videos.length, unsplashPhotos.length, pixabayPhotos.length);
    for (let i = 0; i < maxLen; i++) {
      if (videos[i]) items.push(videos[i]);
      if (unsplashPhotos[i]) items.push(unsplashPhotos[i]);
      if (pixabayPhotos[i]) items.push(pixabayPhotos[i]);
    }

    const payload = {
      category: cat.id,
      updatedAt,
      total: items.length,
      items
    };

    await fs.writeFile(
      path.join('v1/categories', `${cat.id}.json`),
      JSON.stringify(payload, null, 2)
    );
    console.log(`Saved ${cat.id}.json (${items.length} items)`);
  }

  const manifest = {
    version: '1.0.0',
    minSupportedBuild: 1,
    updatedAt,
    cdnBaseUrl: CDN_BASE,
    categories: CATEGORIES.map((c) => ({
      id: c.id,
      name: c.name,
      endpoint: `/categories/${c.id}.json`
    }))
  };

  await fs.writeFile('v1/manifest.json', JSON.stringify(manifest, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
