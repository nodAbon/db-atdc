const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

async function generateOutlinedLogos() {
  const sourcePath = 'C:\\Users\\Owner\\Documents\\총무\\드림베이\\명함\\ci_dreambay.ai.png';
  if (!fs.existsSync(sourcePath)) {
    console.error('Source logo not found:', sourcePath);
    return;
  }

  console.log('Loading source logo:', sourcePath);
  const image = sharp(sourcePath);
  const metadata = await image.metadata();
  console.log('Metadata:', metadata.width, 'x', metadata.height, 'channels:', metadata.channels);

  // Raw RGBA 버퍼 추출
  const { data, info } = await sharp(sourcePath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const width = info.width;
  const height = info.height;

  // 1. 다크 모드용 로고 (로고 주변에 1~2px의 세련된 다크 아웃라인 + 고화질)
  // 2. 라이트 모드용 로고 (텍스트를 #0f172a 딥 슬레이트로 변경 + 주변에 1px 소프트 화이트 아웃라인)

  function createOutlinedImage(isLightMode) {
    const pad = 4; // 아웃라인 공간을 위해 패딩 추가
    const newWidth = width + pad * 2;
    const newHeight = height + pad * 2;
    const outBuffer = Buffer.alloc(newWidth * newHeight * 4, 0);

    // 원본 알파 맵 생성
    const alphaMap = new Uint8Array(width * height);
    const colorMap = [];

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        const a = data[idx + 3];

        alphaMap[y * width + x] = a;

        // 라이트 모드: 흰색 텍스트(밝은 영역)를 다크 슬레이트로 변환
        let newR = r;
        let newG = g;
        let newB = b;

        if (isLightMode) {
          // 심볼 영역(그라데이션 색상)이 아니고 흰색/회색 텍스트인 경우
          const isWhiteText = (r > 200 && g > 200 && b > 200);
          const isNearGray = Math.abs(r - g) < 20 && Math.abs(g - b) < 20 && r > 150;
          if (isWhiteText || isNearGray) {
            newR = 15;  // #0f172a (Deep Slate)
            newG = 23;
            newB = 42;
          }
        }

        colorMap.push({ r: newR, g: newG, b: newB, a });
      }
    }

    // Step 1: 아웃라인 레이어 렌더링 (원 주위 1~2px 확장)
    const outlineRadius = 1.8;
    const outlineColor = isLightMode
      ? { r: 255, g: 255, b: 255, a: 180 } // 라이트 모드: 밝은 소프트 화이트 아웃라인
      : { r: 10, g: 15, b: 30, a: 220 };   // 다크 모드: 딥 네이비/블랙 아웃라인

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const a = alphaMap[y * width + x];
        if (a > 30) {
          // 주변 반경에 아웃라인 찍기
          for (let dy = -2; dy <= 2; dy++) {
            for (let dx = -2; dx <= 2; dx++) {
              const dist = Math.sqrt(dx * dx + dy * dy);
              if (dist <= outlineRadius) {
                const targetX = x + pad + dx;
                const targetY = y + pad + dy;
                if (targetX >= 0 && targetX < newWidth && targetY >= 0 && targetY < newHeight) {
                  const outIdx = (targetY * newWidth + targetX) * 4;
                  const currentA = outBuffer[outIdx + 3];
                  const alphaFactor = Math.max(0, 1 - dist / (outlineRadius + 0.5));
                  const targetAlpha = Math.min(255, Math.round(outlineColor.a * (a / 255) * alphaFactor));

                  if (targetAlpha > currentA) {
                    outBuffer[outIdx] = outlineColor.r;
                    outBuffer[outIdx + 1] = outlineColor.g;
                    outBuffer[outIdx + 2] = outlineColor.b;
                    outBuffer[outIdx + 3] = targetAlpha;
                  }
                }
              }
            }
          }
        }
      }
    }

    // Step 2: 원본 이미지(색상 변환 포함)를 전면에 알파 블렌딩 합성
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const src = colorMap[y * width + x];
        if (src.a > 0) {
          const targetX = x + pad;
          const targetY = y + pad;
          const outIdx = (targetY * newWidth + targetX) * 4;

          const srcAlpha = src.a / 255;
          const bgAlpha = (outBuffer[outIdx + 3] / 255) * (1 - srcAlpha);
          const outAlpha = srcAlpha + bgAlpha;

          if (outAlpha > 0) {
            outBuffer[outIdx] = Math.round((src.r * srcAlpha + outBuffer[outIdx] * bgAlpha) / outAlpha);
            outBuffer[outIdx + 1] = Math.round((src.g * srcAlpha + outBuffer[outIdx + 1] * bgAlpha) / outAlpha);
            outBuffer[outIdx + 2] = Math.round((src.b * srcAlpha + outBuffer[outIdx + 2] * bgAlpha) / outAlpha);
            outBuffer[outIdx + 3] = Math.round(outAlpha * 255);
          }
        }
      }
    }

    return sharp(outBuffer, {
      raw: {
        width: newWidth,
        height: newHeight,
        channels: 4,
      }
    });
  }

  // 1. logo-dark.png (아웃라인 적용)
  const darkLogoPath = path.join(__dirname, '..', 'public', 'logo-dark.png');
  await createOutlinedImage(false)
    .png({ quality: 100, compressionLevel: 9 })
    .toFile(darkLogoPath);
  console.log('✓ Created outlined logo-dark.png:', darkLogoPath);

  // 2. logo-light.png (아웃라인 적용)
  const lightLogoPath = path.join(__dirname, '..', 'public', 'logo-light.png');
  await createOutlinedImage(true)
    .png({ quality: 100, compressionLevel: 9 })
    .toFile(lightLogoPath);
  console.log('✓ Created outlined logo-light.png:', lightLogoPath);
}

generateOutlinedLogos().catch(console.error);
