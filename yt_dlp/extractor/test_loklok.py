import yt_dlp.extractor.loklok
from yt_dlp import YoutubeDL

def test_loklok():
    test_url = 'https://loklok.com/detail/drama/usFT6CCUYfnlQuvhcSY2u-Meet-You-at-the-Blossom'

    ydl_opts = {
        'quiet': False,
        'no_warnings': True,
        'skip_download': True,
        'force_generic_extractor': False,
    }

    with YoutubeDL(ydl_opts) as ydl:
        try:
            info = ydl.extract_info(test_url, download=False)
            print("\n✅ Extraction Success!\n")
            print(f"ID: {info.get('id')}")
            print(f"Title: {info.get('title')}")
            print(f"Thumbnail: {info.get('thumbnail')}")
            print(f"Description: {info.get('description')}")
            print("Formats:")
            for f in info.get('formats', []):
                print(f" - {f.get('format_id')}: {f.get('url')}")
        except Exception as e:
            print(f"\n❌ Error during extraction: {e}")

if __name__ == '__main__':
    test_loklok()
