// Tiptap 에디터 번들 파일
// 브라우저에서 직접 사용할 수 있도록 번들링된 Tiptap 에디터

import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Underline from '@tiptap/extension-underline';
import YouTube from '@tiptap/extension-youtube';

// 이미지에 width/height 속성을 보존하고 조정할 수 있도록 확장
const ResizableImage = Image.extend({
  addAttributes() {
    const inherited = this.parent?.() ?? {};
    return {
      ...inherited,
      width: {
        default: '100%',
        parseHTML: element => element.getAttribute('width') || element.style.width || '100%',
        renderHTML: attributes => {
          const { width, ...rest } = attributes;
          return ['img', { ...rest, width }];
        },
      },
      height: {
        default: null,
        parseHTML: element => element.getAttribute('height') || element.style.height || null,
        renderHTML: attributes => {
          const { height, ...rest } = attributes;
          if (height) {
            return ['img', { ...rest, height }];
          }
          return ['img', rest];
        },
      },
    };
  },
});

// 커스텀 YouTube 확장 (유튜브 링크 자동 변환)
const CustomYouTube = YouTube.extend({
  addPasteRules() {
    return [
      {
        find: /https?:\/\/(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]+)/g,
        handler: ({ state, range, match }) => {
          const videoId = match[1];
          const { tr } = state;
          tr.replaceWith(range.from, range.to, this.type.create({ src: `https://www.youtube.com/embed/${videoId}` }));
        },
      },
    ];
  },
});

// Tiptap 에디터 초기화 함수
export function initTiptapEditor(element, options = {}) {
  console.log('initTiptapEditor 호출됨', element, options);
  const editor = new Editor({
    element,
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      ResizableImage.configure({
        inline: false,
        allowBase64: false,
      }),
      Underline,
      CustomYouTube.configure({
        width: 560,
        height: 315,
        HTMLAttributes: {
          class: 'youtube-embed',
        },
      }),
    ],
    content: options.content || '',
    editorProps: {
      attributes: {
        class: 'ProseMirror',
        'data-placeholder': options.placeholder || '내용을 입력하세요...',
      },
    },
    onUpdate: options.onUpdate || (() => {}),
  });
  
  return editor;
}

