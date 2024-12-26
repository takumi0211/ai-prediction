const API_KEY = 'AIzaSyAlS5wl0mRqtOepymOvhg-303uk_aovHT8';
let playerCount = 1;
let aiResponse = null;

// タッチデバイスの検出と対応
const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

if (isTouchDevice) {
    document.querySelectorAll('button').forEach(button => {
        button.addEventListener('touchstart', function(e) {
            e.preventDefault();
            this.click();
        });
    });

    document.querySelectorAll('input').forEach(input => {
        input.addEventListener('focus', function() {
            setTimeout(() => {
                window.scrollTo(0, window.scrollY + this.getBoundingClientRect().top - 100);
            }, 300);
        });
    });
}

// AIからの回答を取得する関数
async function getAIResponse(question) {
    try {
        const url = `https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent?key=${API_KEY}`;
        
        const prompt = `
あなたは以下の質問に対して、4つの異なる回答を生成してください。
以下の制約を厳密に守ってください：

1. 各回答は50文字以内で答えること
2. 必ず「です」か「ます」で終わる丁寧な表現を使うこと
3. 一文で完結させること
4. 具体的で明確な表現を使うこと
5. 抽象的な表現は避けること
6. 4つの回答は全て異なる内容にすること
7. 4つの回答は全てもっともらしい内容にすること
8. 4つの回答は全て質問に対する適切な答えにすること

質問：${question}

以下の形式で4つの回答を出力してください：
{
    "choices": [
        {"text": "最も適切な回答", "isCorrect": true},
        {"text": "2番目の回答", "isCorrect": false},
        {"text": "3番目の回答", "isCorrect": false},
        {"text": "4番目の回答", "isCorrect": false}
    ]
}`;

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
                }],
                generationConfig: {
                    temperature: 0.9,
                    maxOutputTokens: 1000,
                    topK: 40,
                    topP: 0.95
                }
            })
        });

        if (!response.ok) {
            let errorMessage = 'APIエラーが発生しました';
            try {
                const errorData = await response.json();
                console.error('API Error Response:', errorData);
                errorMessage = errorData.error?.message || errorMessage;
            } catch (e) {
                console.error('Error parsing error response:', e);
            }
            throw new Error(errorMessage);
        }

        const data = await response.json();
        console.log('API Response:', data);

        const responseText = data.candidates[0].content.parts[0].text;
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('APIからの応答が不正な形式です');
        }

        const choices = JSON.parse(jsonMatch[0]);
        return choices;

    } catch (error) {
        console.error('API Error Details:', error);
        const errorMessage = error.message.includes('API') 
            ? 'AIからの回答の取得に失敗しました。しばらく待ってから再度お試しください。'
            : 'エラーが発生しました。インターネット接続を確認してください。';
        showError(errorMessage);
        throw error;
    }
}

// 類似度を計算する関数
async function calculateSimilarity(text1, text2) {
    try {
        const url = `https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent?key=${API_KEY}`;
        
        const prompt = `
あなたは文章の類似度を判定する審査員です。
以下の2つの文章は同じ「愛とは何か」という質問に対する回答です。
これらの回答を比較し、分析してください。

評価対象：
文章1：${text1}
文章2：${text2}

以下のJSON形式で回答してください：
{
    "score": 評価点（0-10の数値）,
    "analysis": "# 評価結果（${text1.substring(0, 10)}... と ${text2.substring(0, 10)}... の比較）\\n\\n
## 類似度: {score}/10点\\n\\n
### 評価理由\\n
{理由を1-2文で}\\n\\n
### 特徴的な違い\\n
- {違い1}\\n
- {違い2}\\n\\n
### 優れている点\\n
- 文章1: {長所}\\n
- 文章2: {長所}"
}`;

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

        if (!response.ok) {
            throw new Error('類似度の評価に失敗しました');
        }

        const data = await response.json();
        const resultText = data.candidates[0].content.parts[0].text;
        
        const jsonMatch = resultText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('類似度の評価結果の解析に失敗しました');
        }

        return JSON.parse(jsonMatch[0]);

    } catch (error) {
        console.error('Similarity Calculation Error:', error);
        showError('類似度の評価中にエラーが発生しました');
        throw error;
    }
}

// ステップ管理
function showStep(stepId) {
    document.querySelectorAll('.step').forEach(step => step.classList.add('hidden'));
    document.getElementById(stepId).classList.remove('hidden');
}

// エラー示関数
function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    
    // 既存のエラーメッセージを削除
    const existingError = document.querySelector('.error-message');
    if (existingError) {
        existingError.remove();
    }
    
    // モバイルの場合は位置を調整
    if (window.innerWidth <= 768) {
        errorDiv.style.top = window.scrollY + 10 + 'px';
    }
    
    document.body.appendChild(errorDiv);
    
    // エラーメッセージを5秒後に消す（モバイルでより長く表示）
    setTimeout(() => {
        errorDiv.remove();
    }, 5000);
}

// ホームに戻る関数
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
        
        // ステップ1に戻
        showStep('step1');
    }
}

// 結果表示関数
function displayResults(data) {
    const aiAnswer = document.getElementById('ai-answer');
    const playerScores = document.getElementById('player-scores');

    aiAnswer.textContent = data.ai_response;
    playerScores.innerHTML = '';

    // スコアを降順にソート
    const sortedScores = [...data.scores].sort((a, b) => b.similarity.score - a.similarity.score);

    sortedScores.forEach((score, index) => {
        const scoreCard = document.createElement('div');
        scoreCard.className = 'score-card';
        
        // マークダウンをHTMLに変換
        const analysisHtml = score.similarity.analysis
            .replace(/^# (.*$)/gm, '<h4>$1</h4>')
            .replace(/^## (.*$)/gm, '<h5>$1</h5>')
            .replace(/^### (.*$)/gm, '<h6>$1</h6>')
            .replace(/^- (.*$)/gm, '<li>$1</li>')
            .replace(/\n\n/g, '</p><p>')
            .replace(/\n/g, '<br>');
        
        scoreCard.innerHTML = `
            <h3>${index + 1}位 プレイヤー${index + 1}</h3>
            <div class="player-prediction">
                <p>予想した回答：</p>
                <p class="prediction-text">${data.playerResponses[index]}</p>
            </div>
            <div class="score-breakdown">
                <div class="analysis-content">
                    ${analysisHtml}
                </div>
            </div>
        `;
        playerScores.appendChild(scoreCard);
    });
}

// イベントリスナー
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
        const choices = await getAIResponse(question);
        document.getElementById('current-question-text').textContent = question;
        
        // 選択肢を表示
        const playersSection = document.getElementById('players-section');
        playersSection.innerHTML = '';
        
        choices.choices.forEach((choice, index) => {
            const choiceDiv = document.createElement('div');
            choiceDiv.className = 'choice-button';
            choiceDiv.innerHTML = `
                <button class="choice" data-correct="${choice.isCorrect}">
                    ${choice.text}
                </button>
            `;
            playersSection.appendChild(choiceDiv);
        });

        // 選択肢のクリックイベントを設定
        document.querySelectorAll('.choice').forEach(button => {
            button.addEventListener('click', function() {
                const isCorrect = this.dataset.correct === 'true';
                const result = document.createElement('div');
                result.className = `result ${isCorrect ? 'correct' : 'incorrect'}`;
                result.textContent = isCorrect ? '正解！' : '不正解...';
                playersSection.appendChild(result);
                
                // すべてのボタンを無効化
                document.querySelectorAll('.choice').forEach(btn => {
                    btn.disabled = true;
                    if (btn.dataset.correct === 'true') {
                        btn.classList.add('correct-answer');
                    }
                });
            });
        });

        showStep('step2');
    } catch (error) {
        console.error('Error:', error);
    } finally {
        button.disabled = false;
        button.classList.remove('loading');
    }
});

// 不要な関数とイベントリスナーを削除
document.getElementById('add-player').remove();
document.getElementById('submit-game').remove();

document.getElementById('play-again').addEventListener('click', () => {
    returnHome();
}); 