const API_KEY = 'AIzaSyAlS5wl0mRqtOepymOvhg-303uk_aovHT8';
let playerCount = 1;
let aiResponse = null;

// Google Gemini APIを使用して回答を取得する関数
async function getAIResponse(question) {
    try {
        const url = `https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent?key=${API_KEY}`;
        
        // シンプルなプロンプトを使用
        const prompt = `質問「${question}」に対して、50文字以内で簡潔に答えてください。必ず「です」か「ます」で終わる丁寧な表現を使ってください。`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: prompt
                    }]
                }]
            })
        });

        // レスポンスのステータスコードをチェック
        if (!response.ok) {
            const errorText = await response.text();
            console.error('API Error Response:', errorText);
            throw new Error(`API Error: ${response.status}`);
        }

        // レスポンスをJSONとしてパース
        let data;
        try {
            data = await response.json();
        } catch (e) {
            console.error('JSON Parse Error:', e);
            throw new Error('APIからの応答を解析できませんでした');
        }

        // デバッグ用にレスポンス全体を出力
        console.log('Full API Response:', data);

        // レスポンスの構造を確認
        if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
            console.error('Unexpected Response Structure:', data);
            throw new Error('APIからの応答が不正な形式です');
        }

        let answer = data.candidates[0].content.parts[0].text.trim();
        
        // 回答の後処理
        answer = answer
            .replace(/^[「『]/g, '') // 開始の括弧を削除
            .replace(/[」』]$/g, '') // 終了の括弧を削除
            .trim();

        // 50文字を超える場合は切り詰める
        if (answer.length > 50) {
            const sentences = answer.split(/[。．.]\s*/);
            answer = sentences[0] + "。";
            
            if (answer.length > 50) {
                answer = answer.substring(0, 47) + "...";
            }
        }

        // 丁寧な表現で終わっていない場合は調整
        if (!answer.endsWith('です。') && !answer.endsWith('ます。')) {
            answer = answer.replace(/。$/, 'です。');
        }

        return answer;

    } catch (error) {
        console.error('API Error Details:', error);
        showError('AIからの回答の取得に失敗しました。しばらく待ってから再度お試しください。');
        throw error;
    }
}

// 類似度を計算する関数（10点満点）
function calculateSimilarity(text1, text2) {
    // 日本語と英語の両方に対応した単語分割
    const words1 = text1.toLowerCase().match(/[一-龠]+|[ぁ-ん]+|[ァ-ン]+|[a-zA-Z]+|[0-9]+/g) || [];
    const words2 = text2.toLowerCase().match(/[一-龠]+|[ぁ-ん]+|[ァ-ン]+|[a-zA-Z]+|[0-9]+/g) || [];
    
    // キーワードの一致度（最大6点）
    const commonWords = words1.filter(word => words2.includes(word));
    const keywordScore = Math.min(6, (commonWords.length * 2) / (words1.length + words2.length) * 6);

    // 文字列長の類似度（最大2点）
    const lengthDiff = Math.abs(text1.length - text2.length);
    const lengthScore = Math.max(0, 2 - (lengthDiff / 25));

    // 文の構造の類似度（最大2点）
    const structureScore = calculateStructureSimilarity(text1, text2);

    return {
        keywordScore,      // 最大6点
        lengthScore,       // 最大2点
        structureScore,    // 最大2点
        total: keywordScore + lengthScore + structureScore,  // 最大10点
        matchedWords: commonWords
    };
}

// 文の構造の類似度を計算
function calculateStructureSimilarity(text1, text2) {
    // 文末表現の一致をチェック（最大1点）
    const endings = ['です', 'ます', 'だ', 'である'];
    const ending1 = endings.find(end => text1.endsWith(end)) || '';
    const ending2 = endings.find(end => text2.endsWith(end)) || '';
    const endingMatch = ending1 === ending2 ? 1 : 0;

    // 文の種類の一致をチェック（最大1点）
    const isQuestion1 = text1.includes('？') || text1.includes('?');
    const isQuestion2 = text2.includes('？') || text2.includes('?');
    const typeMatch = isQuestion1 === isQuestion2 ? 1 : 0;

    return endingMatch + typeMatch;
}

// 創造性を評価する関数を改善
function evaluateCreativity(response, aiResponse) {
    let score = 0;
    
    // 独自の視点（AIの回答にない単語の使用）
    const aiWords = new Set(aiResponse.toLowerCase().match(/[一-龠]+|[ぁ-ん]+|[ァ-ン]+|[a-zA-Z]+|[0-9]+/g) || []);
    const responseWords = new Set(response.toLowerCase().match(/[一-龠]+|[ぁ-ん]+|[ァ-ン]+|[a-zA-Z]+|[0-9]+/g) || []);
    const uniqueWords = [...responseWords].filter(word => !aiWords.has(word));
    
    // ユニークな表現のスコア（0-2点）
    score += Math.min(2, uniqueWords.length / 3);
    
    // 文の長さと構造の適切さ（0-2点）
    const idealLength = 50;
    const lengthScore = Math.max(0, 2 - Math.abs(response.length - idealLength) / 25);
    score += lengthScore;
    
    // 具体例や説明の含有（0-1点）
    if (response.includes('例えば') || response.includes('つまり') || response.includes('なぜなら')) {
        score += 1;
    }

    return {
        score: score,
        uniqueWords: uniqueWords,
        lengthScore: lengthScore
    };
}

// ステップ管理
function showStep(stepId) {
    document.querySelectorAll('.step').forEach(step => step.classList.add('hidden'));
    document.getElementById(stepId).classList.remove('hidden');
}

// エラー表示関数
function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    
    // 既存のエラーメッセージがあれば削除
    const existingError = document.querySelector('.error-message');
    if (existingError) {
        existingError.remove();
    }
    
    document.querySelector('.container').insertBefore(errorDiv, document.querySelector('.game-section'));
    
    // 3秒後にエラーメッセージを消す
    setTimeout(() => {
        errorDiv.remove();
    }, 3000);
}

// ステップ1: 質問入力
document.getElementById('next-to-step2').addEventListener('click', async () => {
    const question = document.getElementById('question').value;
    if (!question) {
        showError('質問を入力してください');
        return;
    }

    const button = document.getElementById('next-to-step2');
    button.disabled = true;
    button.classList.add('loading');

    try {
        aiResponse = await getAIResponse(question);
        document.getElementById('current-question-text').textContent = question;
        showStep('step2');
    } catch (error) {
        console.error('Error:', error);
        // エラーメッセージはshowError関数で表示済み
    } finally {
        button.disabled = false;
        button.classList.remove('loading');
    }
});

// プレイヤー追加
document.getElementById('add-player').addEventListener('click', () => {
    playerCount++;
    const playerInput = document.createElement('div');
    playerInput.className = 'player-input';
    playerInput.innerHTML = `
        <input type="text" placeholder="プレイヤー${playerCount}の予想">
    `;
    document.getElementById('players-section').appendChild(playerInput);
});

// 回答送信
document.getElementById('submit-game').addEventListener('click', async () => {
    const playerInputs = document.querySelectorAll('.player-input input');
    const playerResponses = Array.from(playerInputs).map(input => input.value);

    if (playerResponses.some(response => !response)) {
        showError('すべてのプレイヤーの予想を入力してください');
        return;
    }

    const button = document.getElementById('submit-game');
    button.disabled = true;
    button.classList.add('loading');

    try {
        // 各プレイヤーの回答を評価
        const scores = playerResponses.map(response => ({
            similarity: calculateSimilarity(aiResponse, response)
        }));

        // 結果を表示して次のステップへ
        displayResults({ 
            ai_response: aiResponse, 
            scores: scores,
            playerResponses: playerResponses // プレイヤーの回答を追加
        });
        showStep('results');
    } catch (error) {
        console.error('Error:', error);
        showError('エラーが発生しました。もう一度お試しください。');
    } finally {
        button.disabled = false;
        button.classList.remove('loading');
    }
});

// ホームに戻る関数を追加
function returnHome() {
    if (confirm('ホームに戻りますか？\n現在の進行状況は失われます。')) {
        // 入力をリセット
        document.getElementById('question').value = '';
        document.getElementById('current-question-text').textContent = '';
        document.getElementById('players-section').innerHTML = `
            <div class="player-input">
                <input type="text" placeholder="プレイヤー1の予想">
            </div>
        `;
        playerCount = 1;
        aiResponse = null;
        
        // ステップ1に戻る
        showStep('step1');
    }
}

// もう一度プレイボタンの処理を修正
document.getElementById('play-again').addEventListener('click', () => {
    returnHome(); // 既存の処理を returnHome() に置き換え
});

// 結果表示関数を更新
function displayResults(data) {
    const aiAnswer = document.getElementById('ai-answer');
    const playerScores = document.getElementById('player-scores');

    aiAnswer.textContent = data.ai_response;
    playerScores.innerHTML = '';

    // スコアを降順にソート
    const sortedScores = [...data.scores].sort((a, b) => b.similarity.total - a.similarity.total);

    sortedScores.forEach((score, index) => {
        const scoreCard = document.createElement('div');
        scoreCard.className = 'score-card';
        
        scoreCard.innerHTML = `
            <h3>${index + 1}位 プレイヤー${index + 1}</h3>
            <div class="player-prediction">
                <p>予想した回答：</p>
                <p class="prediction-text">${data.playerResponses[index]}</p>
            </div>
            <div class="score-breakdown">
                <h4>類似度スコア (${score.similarity.total.toFixed(1)}点)</h4>
                <ul>
                    <li>キーワードの一致: ${score.similarity.keywordScore.toFixed(1)}点
                        ${score.similarity.matchedWords.length > 0 ? 
                        `<span class="matched-words">一致: ${score.similarity.matchedWords.join(', ')}</span>` : 
                        ''}
                    </li>
                    <li>文章の長さ: ${score.similarity.lengthScore.toFixed(1)}点</li>
                    <li>文の構造: ${score.similarity.structureScore.toFixed(1)}点</li>
                </ul>
            </div>
        `;
        playerScores.appendChild(scoreCard);
    });
} 