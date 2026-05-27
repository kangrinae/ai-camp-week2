// ============================================================
// 세린클리닉 일일 리서치 자동화 스크립트
// Google Apps Script (구글 시트 > 확장 프로그램 > Apps Script)
// ============================================================

// ▼▼▼ 여기만 설정하세요 ▼▼▼
const SPREADSHEET_ID = '1GVIOuS27_0OhbHxnoxu2VQ070GMORWpHcOZky8FXXjE';
const SHEET_GID = 1630880273;
const CLAUDE_API_KEY = 'YOUR_CLAUDE_API_KEY'; // Anthropic 콘솔에서 발급 후 입력
const GROK_API_KEY   = 'SKIP'; // Grok 미사용
// ▲▲▲ 여기까지 ▲▲▲


// ============================================================
// 메인 함수 — 매일 오전 9시(JST) 자동 실행
// 수동 실행: 이 함수 선택 후 ▶ 버튼 클릭
// ============================================================
function runDailyResearch() {
  const sheet = getTargetSheet();
  if (!sheet) { Logger.log('시트를 찾을 수 없습니다.'); return; }

  const timestamp = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd HH:mm');
  Logger.log(`[${timestamp}] 리서치 시작`);

  // Grok — X 실시간 데이터 수집 (API 키 설정 시)
  const grokData = (GROK_API_KEY !== 'YOUR_GROK_API_KEY') ? fetchFromGrok() : null;

  // 각 파트 수집
  const collected = {
    '업계 이슈':              fetchIndustryIssues(grokData),
    '경쟁사 동향':            fetchCompetitorLinks(grokData),
    '마케팅 트렌드 (뷰티)':   fetchBeautyTrends(grokData),
    '마케팅 트렌드 (일반)':   fetchGeneralTrends(grokData),
    '고객리뷰':               buildReviewLinks(grokData),
  };

  // 시트에 쓰기
  writeAllSections(sheet, collected, timestamp);

  // Claude API로 요약 + 인사이트 자동 생성
  if (CLAUDE_API_KEY !== 'YOUR_CLAUDE_API_KEY') {
    const ai = callClaudeForSummary(collected);
    writeAISections(sheet, ai);
  } else {
    Logger.log('Claude API 키 미설정 — 금일내용요약/인사이트는 수동 작성 필요');
  }

  Logger.log('완료!');
}


// ============================================================
// 파트 1 — 업계 이슈
// 자동: 야후뉴스 RSS + 마이니치 RSS 필터링
// 수동링크: 유튜브, 스레드, 인스타, 야후리얼타임
// ============================================================
function fetchIndustryIssues(grokData) {
  const keywords = ['皮膚科', '美容皮膚科', '肌荒れ', '皮膚クリニック', 'スキンケア', 'レーザー'];
  const lines = [];

  if (grokData && grokData.industry) {
    lines.push('【Grok — X 실시간 업계 이슈】\n');
    lines.push(grokData.industry);
    lines.push('\n---\n');
  }

  lines.push('【자동 수집 — 야후뉴스·마이니치 RSS】\n');

  // Yahoo Japan News RSS
  const yahooFeeds = [
    'https://news.yahoo.co.jp/rss/categories/domestic.xml',
    'https://news.yahoo.co.jp/rss/categories/science.xml',
  ];
  for (const feed of yahooFeeds) {
    const items = fetchAndFilterRSS(feed, keywords, 7);
    items.slice(0, 3).forEach(i => lines.push(`• ${i.title}\n  ${i.link}\n`));
  }

  // Mainichi RSS
  const mainichi = fetchAndFilterRSS('https://mainichi.jp/rss/articles.rss', keywords, 7);
  mainichi.slice(0, 2).forEach(i => lines.push(`• ${i.title}\n  ${i.link}\n`));

  // 수동 확인 링크 (클릭해서 직접 탐색)
  lines.push('\n【수동 확인 링크 — 로그인 후 탐색】');
  lines.push('• 야후뉴스: https://news.yahoo.co.jp/flash');
  lines.push('• 마이니치: https://mainichi.jp');
  lines.push('• 야후리얼타임 [皮膚科]: https://search.yahoo.co.jp/realtime/search?p=%E7%9A%AE%E8%86%9A%E7%A7%91&ei=UTF-8');
  lines.push('• 야후리얼타임 [美容皮膚科]: https://search.yahoo.co.jp/realtime/search?p=%E7%BE%8E%E5%AE%B9%E7%9A%AE%E8%86%9A%E7%A7%91&ei=UTF-8');
  lines.push('• 유튜브 [皮膚科]: https://www.youtube.com/results?search_query=%E7%9A%AE%E8%86%9A%E7%A7%91&sp=CAI%3D');
  lines.push('• 스레드: https://www.threads.com/search?q=%E7%9A%AE%E8%86%9A%E7%A7%91&serp_type=default');
  lines.push('• 인스타: https://www.google.com/search?q=%E7%9A%AE%E8%86%9A%E7%A7%91+%E3%82%A4%E3%83%B3%E3%82%B9%E3%82%BF%E3%82%B0%E3%83%A9%E3%83%A0&lr=lang_ja&tbs=qdr:w');

  return lines.join('\n');
}


// ============================================================
// 파트 2 — 경쟁사 동향 (한국/일본 피부과)
// 야후리얼타임 검색 URL 자동 생성
// ============================================================
function fetchCompetitorLinks(grokData) {
  const queries = [
    '韓国皮膚科 日本',
    '美容皮膚科 キャンペーン',
    '皮膚科 新メニュー',
    '皮膚科 モニター募集',
  ];
  const lines = [];

  if (grokData && grokData.competitor) {
    lines.push('【Grok — X 실시간 경쟁사 동향】\n');
    lines.push(grokData.competitor);
    lines.push('\n---\n');
  }

  lines.push('【경쟁사 동향 탐색 링크】\n');
  lines.push('[야후 리얼타임 검색]');
  queries.forEach(q => {
    lines.push(`• [${q}]: https://search.yahoo.co.jp/realtime/search?p=${encodeURIComponent(q)}&ei=UTF-8`);
  });

  lines.push('\n[플랫폼별 탐색]');
  lines.push('• 강남언니 (일본 한국피부과): https://www.gangnamunni.com/search?keyword=%E7%9A%AE%E8%86%9A%E7%A7%91');
  lines.push('• 유튜브 [韓国皮膚科]: https://www.youtube.com/results?search_query=%E9%9F%93%E5%9B%BD%E7%9A%AE%E8%86%9A%E7%A7%91+%E6%97%A5%E6%9C%AC&sp=CAI%3D');
  lines.push('• 스레드 [韓国皮膚科]: https://www.threads.com/search?q=%E9%9F%93%E5%9B%BD%E7%9A%AE%E8%86%9A%E7%A7%91&serp_type=default');
  lines.push('• 인스타 구글경유: https://www.google.com/search?q=%E9%9F%93%E5%9B%BD%E7%9A%AE%E8%86%9A%E7%A7%91+%E3%82%A4%E3%83%B3%E3%82%B9%E3%82%BF%E3%82%B0%E3%83%A9%E3%83%A0&lr=lang_ja&tbs=qdr:w');

  return lines.join('\n');
}


// ============================================================
// 파트 3 — 마케팅 트렌드 (뷰티 & 미용)
// 자동: 야후 치에부쿠로 피부과 카테고리
// ============================================================
function fetchBeautyTrends(grokData) {
  const lines = [];

  if (grokData && grokData.beautyTrend) {
    lines.push('【Grok — X 실시간 피부 고민·후기】\n');
    lines.push(grokData.beautyTrend);
    lines.push('\n---\n');
  }

  // 야후 치에부쿠로 피부과 카테고리 스크래핑 시도
  try {
    const res = UrlFetchApp.fetch(
      'https://chiebukuro.yahoo.co.jp/category/2079639835/question/list',
      { muteHttpExceptions: true, headers: { 'User-Agent': 'Mozilla/5.0' } }
    );
    if (res.getResponseCode() === 200) {
      const questions = extractChiebukuroQuestions(res.getContentText());
      if (questions.length > 0) {
        lines.push('【야후 치에부쿠로 — 최근 피부 고민 질문】\n');
        questions.slice(0, 5).forEach(q => lines.push(`• ${q.title}\n  ${q.url}\n`));
      }
    }
  } catch (e) {
    Logger.log('치에부쿠로 오류: ' + e.message);
  }

  lines.push('\n【수동 탐색 링크】');
  lines.push('• 야후 치에부쿠로: https://chiebukuro.yahoo.co.jp/category/2079639835/question/list');
  lines.push('• 야후리얼타임 [肌悩み]: https://search.yahoo.co.jp/realtime/search?p=%E8%82%8C%E6%82%A9%E3%81%BF&ei=UTF-8');
  lines.push('• 야후리얼타임 [皮膚科 口コミ]: https://search.yahoo.co.jp/realtime/search?p=%E7%9A%AE%E8%86%9A%E7%A7%91+%E5%8F%A3%E3%82%B3%E3%83%9F&ei=UTF-8');
  lines.push('• 유튜브 [皮膚科 体験]: https://www.youtube.com/results?search_query=%E7%9A%AE%E8%86%9A%E7%A7%91+%E4%BD%93%E9%A8%93&sp=CAI%3D');
  lines.push('• 스레드: https://www.threads.com/search?q=%E7%9A%AE%E8%86%9A%E7%A7%91+%E5%8F%A3%E3%82%B3%E3%83%9F&serp_type=default');
  lines.push('• 인스타 구글경유: https://www.google.com/search?q=%E7%9A%AE%E8%86%9A%E7%A7%91+%E5%8F%A3%E3%82%B3%E3%83%9F+%E3%82%A4%E3%83%B3%E3%82%B9%E3%82%BF%E3%82%B0%E3%83%A9%E3%83%A0&lr=lang_ja&tbs=qdr:w');

  return lines.join('\n');
}


// ============================================================
// 파트 4 — 마케팅 트렌드 (일반)
// 자동: Google Trends JP RSS
// ============================================================
function fetchGeneralTrends(grokData) {
  const lines = [];

  if (grokData && grokData.generalTrend) {
    lines.push('【Grok — X 일본 오늘의 버즈 트렌드】\n');
    lines.push(grokData.generalTrend);
    lines.push('\n---\n');
  }

  // Google Trends JP — 오늘 급상승 키워드
  try {
    const res = UrlFetchApp.fetch(
      'https://trends.google.co.jp/trends/trendingsearches/daily/rss?geo=JP',
      { muteHttpExceptions: true }
    );
    if (res.getResponseCode() === 200) {
      const items = parseRSS(res.getContentText());
      if (items.length > 0) {
        lines.push('【Google Trends JP — 오늘 급상승 키워드 TOP 5】\n');
        items.slice(0, 5).forEach((item, idx) => {
          lines.push(`${idx + 1}. ${item.title}`);
          if (item.link) lines.push(`   ${item.link}`);
        });
        lines.push('');
      }
    }
  } catch (e) {
    Logger.log('Google Trends 오류: ' + e.message);
  }

  lines.push('【수동 탐색 링크】');
  lines.push('• 구글 트렌드 JP: https://trends.google.co.kr/trending?geo=JP');
  lines.push('• 유튜브 트렌드 (yutura): https://en.yutura.net/');
  lines.push('• 야후 재팬 급상승: https://search.yahoo.co.jp');
  lines.push('• 야후 리얼타임: https://search.yahoo.co.jp/realtime');
  lines.push('• 인스타 트렌드: https://www.instagram.com/explore/search/keyword/?q=%23%E3%83%88%E3%83%AC%E3%83%B3%E3%83%89');
  lines.push('• 스레드: https://www.threads.com/?hl=ja');

  return lines.join('\n');
}


// ============================================================
// 파트 5 — 고객리뷰/컴플레인
// セリンクリニック / セリン医院 검색 링크 자동 생성
// ============================================================
function buildReviewLinks(grokData) {
  const clinics = ['セリンクリニック', 'セリン医院'];
  const lines = [];

  if (grokData && grokData.review) {
    lines.push('【Grok — X 실시간 セリンクリニック 언급】\n');
    lines.push(grokData.review);
    lines.push('\n---\n');
  }

  lines.push('【고객리뷰/컴플레인 탐색 링크 — 직접 로그인 후 확인】\n');

  clinics.forEach(name => {
    const enc = encodeURIComponent(name);
    lines.push(`▶ ${name}`);
    lines.push(`• 인스타: https://www.instagram.com/explore/search/keyword/?q=${enc}`);
    lines.push(`• 구글경유 인스타: https://www.google.com/search?q=${enc}+%E3%82%A4%E3%83%B3%E3%82%B9%E3%82%BF%E3%82%B0%E3%83%A9%E3%83%A0&lr=lang_ja`);
    lines.push(`• 야후리얼타임(X): https://search.yahoo.co.jp/realtime/search?p=${enc}&ei=UTF-8`);
    lines.push(`• 유튜브: https://www.youtube.com/results?search_query=${enc}`);
    lines.push(`• 구글플레이스: https://www.google.com/search?q=${enc}+%E5%8F%A3%E3%82%B3%E3%83%9F`);
    lines.push(`• 강남언니: https://www.gangnamunni.com/search?keyword=${enc}`);
    lines.push('');
  });

  return lines.join('\n');
}


// ============================================================
// Claude API — 금일내용요약 + 인사이트 생성
// ============================================================
function callClaudeForSummary(collected) {
  const context = Object.entries(collected)
    .map(([k, v]) => `## ${k}\n${v.slice(0, 800)}`) // 토큰 절약
    .join('\n\n');

  const prompt = `당신은 일본 미용의료 시장 전문 마케터입니다.
아래는 오늘 수집한 일일 리서치 결과입니다.

${context}

다음 두 항목을 한국어로 작성하세요.

[금일내용요약]
• 위 내용을 3~5줄 불릿 포인트로 핵심만 요약

[인사이트]
• セリンクリニック에서 오늘 어필할 수 있는 포인트 1~2개
• 실행 가능한 SNS 콘텐츠 전략 2~3개 (구체적으로)
• 주의해야 할 리스크나 트렌드 1개

중요 항목 앞에는 ★ 표시를 붙여주세요.`;

  try {
    const res = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      payload: JSON.stringify({
        model: 'claude-haiku-4-5-20251001', // 빠르고 저렴
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      }),
      muteHttpExceptions: true,
    });

    const json = JSON.parse(res.getContentText());
    if (json.content && json.content[0]) {
      return json.content[0].text;
    }
  } catch (e) {
    Logger.log('Claude API 오류: ' + e.message);
  }
  return null;
}


// ============================================================
// 시트 쓰기 — 파트명(B열) 매칭 → C열에 내용 기입
// ============================================================
function writeAllSections(sheet, collected, timestamp) {
  const data = sheet.getDataRange().getValues();

  // B열 키워드 → collected 키 매핑
  const mapping = [
    { keyword: '업계 이슈',  key: '업계 이슈' },
    { keyword: '경쟁사',     key: '경쟁사 동향' },
    { keyword: '트랜드 (뷰티', key: '마케팅 트렌드 (뷰티)' },
    { keyword: '트랜드 (일반', key: '마케팅 트렌드 (일반)' },
    { keyword: '트렌드 (뷰티', key: '마케팅 트렌드 (뷰티)' },
    { keyword: '트렌드 (일반', key: '마케팅 트렌드 (일반)' },
    { keyword: '고객리뷰',   key: '고객리뷰' },
    { keyword: '컴플레인',   key: '고객리뷰' },
  ];

  Logger.log(`시트 총 ${data.length}행 처리 시작`);
  let writeCount = 0;

  for (let i = 0; i < data.length; i++) {
    const cellB = String(data[i][1] || '');
    for (const { keyword, key } of mapping) {
      if (cellB.includes(keyword)) {
        if (collected[key]) {
          sheet.getRange(i + 1, 3)
            .setValue(`[${timestamp} 자동업데이트]\n\n${collected[key]}`);
          Logger.log(`✅ 행${i+1} 쓰기 완료: "${cellB.slice(0,20)}"`);
          writeCount++;
        } else {
          Logger.log(`⚠️ 행${i+1} 키 없음: keyword="${keyword}", key="${key}"`);
        }
        break;
      }
    }
  }

  Logger.log(`총 ${writeCount}개 행 업데이트 완료`);
}


// ============================================================
// 시트 쓰기 — AI 생성 요약·인사이트
// ============================================================
function writeAISections(sheet, aiText) {
  if (!aiText) return;

  const summaryMatch = aiText.match(/\[금일내용요약\]([\s\S]*?)(\[인사이트\]|$)/);
  const insightMatch = aiText.match(/\[인사이트\]([\s\S]*?)$/);

  const summary = summaryMatch ? summaryMatch[1].trim() : '';
  const insight = insightMatch ? insightMatch[1].trim() : '';

  const data = sheet.getDataRange().getValues();
  for (let i = 0; i < data.length; i++) {
    const cellB = String(data[i][1] || '');

    if (summary && (cellB.includes('금일내용요약') || cellB.includes('요약'))) {
      sheet.getRange(i + 1, 3).setValue(summary);
    }

    if (insight && cellB.includes('인사이트')) {
      const cell = sheet.getRange(i + 1, 3);
      cell.setValue(insight);
      cell.setFontColor('#CC0000');   // 빨간색 강조
      cell.setFontWeight('bold');
    }
  }
}


// ============================================================
// 유틸 — 대상 시트 찾기
// ============================================================
function getTargetSheet() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  for (const sheet of ss.getSheets()) {
    if (sheet.getSheetId() === SHEET_GID) return sheet;
  }
  return null;
}


// ============================================================
// 유틸 — RSS 가져오기 + 키워드/날짜 필터
// ============================================================
function fetchAndFilterRSS(url, keywords, daysAgo) {
  try {
    const res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    if (res.getResponseCode() !== 200) return [];
    const items = parseRSS(res.getContentText());
    const cutoff = new Date(Date.now() - daysAgo * 86400000);
    return items.filter(item => {
      const pub = new Date(item.pubDate);
      if (isNaN(pub) || pub < cutoff) return false;
      const text = (item.title + ' ' + item.description).toLowerCase();
      return keywords.some(kw => text.includes(kw.toLowerCase()));
    });
  } catch (e) {
    Logger.log(`RSS 오류 (${url}): ${e.message}`);
    return [];
  }
}


// ============================================================
// 유틸 — RSS XML 파싱
// ============================================================
function parseRSS(xml) {
  const items = [];
  try {
    const doc = XmlService.parse(xml);
    const root = doc.getRootElement();
    const ns = root.getNamespace();
    const channel = root.getChild('channel', ns) || root.getChild('channel');
    if (!channel) return items;
    const rssItems = channel.getChildren('item');
    for (const el of rssItems) {
      items.push({
        title:       el.getChildText('title')       || '',
        link:        el.getChildText('link')        || '',
        pubDate:     el.getChildText('pubDate')     || '',
        description: el.getChildText('description') || '',
      });
    }
  } catch (e) {
    Logger.log('RSS 파싱 오류: ' + e.message);
  }
  return items;
}


// ============================================================
// 유틸 — 야후 치에부쿠로 HTML에서 질문 추출
// ============================================================
function extractChiebukuroQuestions(html) {
  const results = [];
  const regex = /href="(https:\/\/detail\.chiebukuro\.yahoo\.co\.jp\/qa\/question_detail\/[^"]+)"[^>]*>([^<]{10,120})</g;
  let m;
  while ((m = regex.exec(html)) !== null) {
    results.push({ url: m[1], title: m[2].trim() });
    if (results.length >= 8) break;
  }
  return results;
}


// ============================================================
// Grok (xAI) — X 실시간 데이터 수집
// 파트별 일본어 X 트렌드·후기·경쟁사 동향을 한 번에 수집
// ============================================================
function fetchFromGrok() {
  const today = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd');

  const queries = {
    industry: `今日(${today})の日本のXで話題になっている皮膚科・美容皮膚科・肌トラブルに関する最新投稿やトレンドを5件、タイトルと内容の要約を日本語で教えてください。`,
    competitor: `今週(${today}基準)の日本のXで、日本国内の美容皮膚科・韓国系皮膚科クリニックがアップしたプロモーション投稿や新メニュー情報を3〜5件、内容と投稿者アカウント名を教えてください。`,
    beautyTrend: `今週(${today}基準)の日本のXで、一般ユーザーが投稿した皮膚科・肌悩み・美容施術に関するリアルな体験談や口コミを5件、要約して教えてください。`,
    generalTrend: `今日(${today})の日本のXでバズっているトレンドワードTOP5と、それぞれの概要を日本語で教えてください。`,
    review: `日本のXで「セリンクリニック」または「セリン医院」に関する最新の口コミ・投稿を3〜5件、内容と投稿日を教えてください。見つからない場合はその旨を伝えてください。`,
  };

  const results = {};
  for (const [key, prompt] of Object.entries(queries)) {
    try {
      const res = UrlFetchApp.fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${GROK_API_KEY}`,
          'Content-Type': 'application/json',
        },
        payload: JSON.stringify({
          model: 'grok-3-latest',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 800,
        }),
        muteHttpExceptions: true,
      });

      const json = JSON.parse(res.getContentText());
      if (json.choices && json.choices[0]) {
        results[key] = json.choices[0].message.content.trim();
      } else {
        Logger.log(`Grok [${key}] 응답 없음: ${res.getContentText().slice(0, 200)}`);
      }
      Utilities.sleep(500); // API 속도 제한 방지
    } catch (e) {
      Logger.log(`Grok [${key}] 오류: ${e.message}`);
    }
  }

  return results;
}


// ============================================================
// 디버그 — B열 값 확인 (시트 매칭 안 될 때 실행)
// ============================================================
function debugSheetColumns() {
  const sheet = getTargetSheet();
  if (!sheet) { Logger.log('시트를 찾을 수 없습니다.'); return; }

  const data = sheet.getDataRange().getValues();
  Logger.log(`총 ${data.length}행 발견`);
  data.forEach((row, i) => {
    Logger.log(`행${i+1} | A: "${row[0]}" | B: "${row[1]}" | C앞30자: "${String(row[2]).slice(0,30)}"`);
  });
}


// ============================================================
// 트리거 설정 — 최초 1회만 실행
// Apps Script > 트리거(시계 아이콘) 에서도 설정 가능
// ============================================================
function setDailyTrigger() {
  // 기존 트리거 모두 삭제
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));

  // 매일 오전 9시 JST 실행
  ScriptApp.newTrigger('runDailyResearch')
    .timeBased()
    .atHour(9)
    .everyDays(1)
    .inTimezone('Asia/Tokyo')
    .create();

  Logger.log('✅ 트리거 설정 완료 — 매일 오전 9시 (JST) 자동 실행');
}
