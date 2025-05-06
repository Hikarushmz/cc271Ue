from .common import InfoExtractor
from ..utils import (
    try_get,
    clean_html,
)
import json
import html

class LoklokIE(InfoExtractor):
    _VALID_URL = r'https?://(?:www\.)?loklok\.com/detail/(?:movie|drama)/(?P<id>[\w-]+)'
    _TESTS = [{
        'url': 'https://loklok.com/detail/movie/zVFmC9N6CB8M42UHe7QEi-Gintama-2-Rules-are-Made-to-be-Broken',
        'only_matching': True,
    }]

    def _real_extract(self, url):
        video_id = self._match_id(url)

        # Ambil halaman utama
        webpage = self._download_webpage(url, video_id)

        # Ambil JSON dari script id="__NEXT_DATA__"
        next_data_json = self._search_regex(
            r'<script id="__NEXT_DATA__"[^>]*type="application/json"[^>]*>(.*?)</script>',
            webpage, 'next_data')
        next_data = json.loads(next_data_json)

        # Navigasi ke ID yang dibutuhkan
        share_info = try_get(next_data, lambda x: x['props']['pageProps']['shareInfo'], dict)
        content_id = str(share_info.get('id'))
        episode_id = str(share_info.get('episodeId'))
        lang = 'in_ID'

        api_url = (
            f'https://mobile-api.lepou.top/cms/web/share/detail'
            f'?id={content_id}&category=1&episodeId={episode_id}&language={lang}&clientType=android_bergel'
        )

        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
            'Referer': 'https://loklok.com/',
            'Accept': 'application/json',
            'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
            'Origin': 'https://loklok.com',
        }

        # Ambil HTML dari API response (sebetulnya iframe embed)
        iframe_html = self._download_webpage(api_url, video_id, headers=headers)

        iframe_url = self._search_regex(
            r'<iframe[^>]+src=["\']([^"\']+)', iframe_html, 'iframe URL')
        iframe_url = html.unescape(iframe_url)
        self.to_screen(f'DEBUG iframe URL: {iframe_url}')

        # Ambil isi iframe
        iframe_page = self._download_webpage(iframe_url, video_id, note='Downloading iframe page')

        hls_url = self._search_regex(
            r'(https?://[^"\']+\.m3u8[^"\']*)', iframe_page, 'HLS URL')

        title = self._html_search_meta('og:title', iframe_page, default='Loklok Video')
        thumb = self._html_search_meta('og:image', iframe_page)
        desc = self._html_search_meta('og:description', iframe_page)

        formats, subs = self._extract_m3u8_formats_and_subtitles(
            hls_url, video_id, ext='mp4', entry_protocol='m3u8_native',
            m3u8_id='hls', fatal=True)

        return {
            'id': video_id,
            'title': clean_html(title),
            'formats': formats,
            'subtitles': subs,
            'description': clean_html(desc),
            'thumbnail': thumb,
        }
