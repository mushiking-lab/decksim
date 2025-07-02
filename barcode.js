document.addEventListener('DOMContentLoaded', () => {
    const barcodeContainer = document.getElementById('barcode-container');

    // 1. URLからカードIDのリストを取得
    const urlParams = new URLSearchParams(window.location.search);
    const cardIds = urlParams.get('cards')?.split(',') || [];

    if (cardIds.length === 0) {
        barcodeContainer.innerHTML = '<p>表示するカードが選択されていません。</p>';
        return;
    }

    // 2. data.jsonを読み込んでバーコードを生成
    async function generateBarcodes() {
        try {
            const [licenseRes, mushiRes, wazaRes] = await Promise.all([
                fetch('data/license.json'),
                fetch('data/mushi.json'),
                fetch('data/waza.json')
            ]);
            const licenseData = await licenseRes.json();
            const mushiData = await mushiRes.json();
            const wazaData = await wazaRes.json();

            // 全カードを一つの配列にまとめて検索しやすくする
            const allCards = [...licenseData, ...mushiData, ...wazaData];
            const cardDataMap = new Map(allCards.map(card => [card.internal_id, card]));

            // 3. IDに基づいてカード情報を取得し、バーコードを生成
            cardIds.forEach(id => {
                const card = cardDataMap.get(id);
                if (card) {
                    const item = document.createElement('div');
                    item.className = 'barcode-item';

                    const name = document.createElement('div');
                    name.className = 'card-name';
                    name.textContent = card.name;

                    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                    svg.id = `barcode-${card.internal_id}`;

                    const data = document.createElement('div');
                    data.className = 'barcode-data';
                    data.textContent = card.barcode_data;

                    item.appendChild(name);
                    item.appendChild(svg);
                    item.appendChild(data);
                    barcodeContainer.appendChild(item);

                    // JsBarcodeライブラリでバーコードを描画
                    JsBarcode(`#barcode-${card.internal_id}`, card.barcode_data, {
                        format: "CODE39",
                        lineColor: "#000",
                        width: 2,
                        height: 100,
                        displayValue: false
                    });
                }
            });

        } catch (error) {
            console.error("バーコードの生成に失敗しました:", error);
            barcodeContainer.innerHTML = '<p>バーコードの生成中にエラーが発生しました。</p>';
        }
    }

    generateBarcodes();
});
