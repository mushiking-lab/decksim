document.addEventListener('DOMContentLoaded', () => {
    // DOM要素の取得
    const slotsRow1 = document.getElementById('slots-row1');
    const slotsRow2 = document.getElementById('slots-row2');
    const generateBtn = document.getElementById('generate-btn');
    const cardList = document.getElementById('card-list');
    const cardListHeader = document.getElementById('card-list-header');
    const versionFiltersContainer = document.getElementById('version-filters');
    const mushiFiltersContainer = document.getElementById('mushi-filters');
    const mushiSizeFiltersContainer = document.getElementById('mushi-size-filters');
    const mushiSukumiCheckboxes = document.getElementById('mushi-sukumi-checkboxes');
    const mushiPersonalityCheckboxes = document.getElementById('mushi-personality-checkboxes');
    const wazaFiltersContainer = document.getElementById('waza-filters');
    const wazaCompatibilityFiltersContainer = document.getElementById('waza-compatibility-filters');
    const alertContainer = document.getElementById('customize-assist').querySelector('#alert-container');

    let allData = {};
    let wazaDataMap = new Map();
    let selectedCards = { license: null, mushi: null, waza_rock: null, waza_scissors: null, waza_paper: null };
    let activeSlotId = null;
    let sortState = { key: null, direction: 'asc' };

    const slotDefinitions = {
        license: { id: 'license', label: 'ライセンス', type: 'license', row: 1 },
        mushi: { id: 'mushi', label: 'ムシカード', type: 'mushi', row: 1 },
        waza_rock: { id: 'waza_rock', label: 'ワザ (ダゲキ)', type: 'waza', skill: 'rock', row: 2 },
        waza_scissors: { id: 'waza_scissors', label: 'ワザ (ハサミ)', type: 'waza', skill: 'scissors', row: 2 },
        waza_paper: { id: 'waza_paper', label: 'ワザ (ナゲ)', type: 'waza', skill: 'paper', row: 2 }
    };

    async function initializeApp() {
        try {
            const [licenseRes, mushiRes, wazaRes] = await Promise.all([
                fetch('data/license.json'),
                fetch('data/mushi.json'),
                fetch('data/waza.json')
            ]);

            const licenseData = await licenseRes.json();
            const mushiData = await mushiRes.json();
            const wazaData = await wazaRes.json();

            allData = { license: licenseData, mushi: mushiData, waza: wazaData };

            allData.waza.forEach(w => wazaDataMap.set(w.internal_id, w));

            createSelectionSlots();
            createFilters();
            updateCardList();
        } catch (error) {
            console.error("Failed to read card data:", error);
            cardList.textContent = 'カードデータの読み込みに失敗しました。';
        }
    }

    function createSelectionSlots() {
        Object.values(slotDefinitions).forEach(def => {
            const slot = document.createElement('div');
            slot.id = `slot-${def.id}`;
            slot.className = 'slot';
            slot.dataset.slotId = def.id;
            slot.textContent = def.label;
            slot.addEventListener('click', () => onSlotClick(def.id));
            if (def.row === 1) slotsRow1.appendChild(slot);
            else slotsRow2.appendChild(slot);
        });
    }

    function createFilters() {
        // Version Filters (Checkboxes)
        const versions = [...new Set([...allData.mushi, ...allData.waza].map(c => c.version))];
        versions.forEach(version => {
            createCheckbox(versionFiltersContainer, version, 'version', version, updateCardList);
        });

        // Mushi Size Filters
        ['大型', '中型', '小型'].forEach(size => {
            createCheckbox(mushiSizeFiltersContainer, size, 'mushi-size', size, updateCardList);
        });

        // Mushi Sukumi Filters
        ['グー', 'チョキ', 'パー'].forEach(sukumi => {
            createCheckbox(mushiSukumiCheckboxes, sukumi, 'mushi-sukumi', sukumi, updateCardList);
        });

        // Mushi Personality Filters
        const personalities = [...new Set(allData.mushi.map(m => m.personality))].filter(p => p);
        personalities.forEach(personality => {
            createCheckbox(mushiPersonalityCheckboxes, personality, 'mushi-personality', personality, updateCardList);
        });

        // Waza Property Filters
        createCheckbox(wazaCompatibilityFiltersContainer, '相性◎(通常技)', 'waza-property', 'compat', updateCardList);
        createCheckbox(wazaCompatibilityFiltersContainer, '特殊技', 'waza-property', 'special', updateCardList);
    }
    
    function createCheckbox(container, label, name, value, listener) {
        const div = document.createElement('div');
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.name = name;
        input.value = value;
        input.id = `${name}-${value}`;
        input.addEventListener('change', listener);
        
        const labelEl = document.createElement('label');
        labelEl.htmlFor = `${name}-${value}`;
        labelEl.textContent = label;
        
        div.appendChild(input);
        div.appendChild(labelEl);
        container.appendChild(div);
    }

    function onSlotClick(slotId) {
        if (selectedCards[slotId]) return;
        activeSlotId = slotId;
        sortState = { key: null, direction: 'asc' }; // Reset sort on new slot selection
        document.querySelectorAll('.slot').forEach(s => s.classList.remove('active'));
        document.getElementById(`slot-${slotId}`).classList.add('active');
        updateFilterVisibility();
        updateCardList();
    }

    function updateFilterVisibility() {
        const slotDef = slotDefinitions[activeSlotId];
        mushiFiltersContainer.classList.toggle('hidden', slotDef?.type !== 'mushi');
        document.getElementById('mushi-sukumi-filters').classList.toggle('hidden', slotDef?.type !== 'mushi');
        document.getElementById('mushi-personality-filters').classList.toggle('hidden', slotDef?.type !== 'mushi');
        wazaFiltersContainer.classList.toggle('hidden', slotDef?.type !== 'waza');
    }

    function handleSort(key) {
        if (sortState.key === key) {
            sortState.direction = sortState.direction === 'asc' ? 'desc' : 'asc';
        } else {
            sortState.key = key;
            sortState.direction = 'asc';
        }
        updateCardList();
    }

    function updateCardList() {
        cardList.innerHTML = '';
        cardListHeader.innerHTML = ''; // Clear header

        if (!activeSlotId) {
            cardList.innerHTML = '<p>上部メニューからカスタマイズするカードの種類を選択してください。</p>';
            cardListHeader.classList.add('hidden'); // Hide header when no slot is active
            return;
        }

        cardListHeader.classList.remove('hidden'); // Show header when a slot is active

        const slotDef = slotDefinitions[activeSlotId];
        let sourceData = allData[slotDef.type] || [];

        // Define headers based on card type
        let headers = [];
        if (slotDef.type === 'mushi') {
            headers = [
                { key: 'card_no', label: 'カードNo.', className: 'card-no' },
                { key: 'name', label: 'カード名', className: 'name' },
                { key: 'strength', label: '強さ', className: 'strength' },
                { key: 'personality', label: '性格', className: 'personality' },
                { key: 'family', label: '学名', className: 'family' },
                { key: 'remarks', label: '備考', className: 'remarks' }
            ];
        } else if (slotDef.type === 'waza') {
            headers = [
                { key: 'card_no', label: 'カードNo.', className: 'card-no' },
                { key: 'name', label: 'カード名', className: 'name' },
                { key: 'technique', label: 'テクニック', className: 'strength' }
            ];
        } else if (slotDef.type === 'license') {
            headers = [
                { key: 'name', label: 'カード名', className: 'name' }
            ];
        }

        // Render header
        headers.forEach(header => {
            const headerItem = document.createElement('div');
            headerItem.className = `header-item ${header.className}`;
            headerItem.textContent = header.label;
            headerItem.addEventListener('click', () => handleSort(header.key));

            if (sortState.key === header.key) {
                headerItem.classList.add('sort-active');
                headerItem.textContent += sortState.direction === 'asc' ? ' ▲' : ' ▼';
            }

            cardListHeader.appendChild(headerItem);
        });

        // --- Filtering Logic ---
        const checkedVersions = getCheckedValues('version');
        const checkedSizes = getCheckedValues('mushi-size');
        const checkedSukumi = getCheckedValues('mushi-sukumi');
        const checkedPersonalities = getCheckedValues('mushi-personality');
        let checkedWazaProperties = getCheckedValues('waza-property');

        // If 'compat' is checked without a mushi, ignore the compat filter.
        if (!selectedCards.mushi) {
            checkedWazaProperties = checkedWazaProperties.filter(p => p !== 'compat');
        }

        let filteredCards = sourceData.filter(card => {
            // Version filter
            if (checkedVersions.length > 0 && !checkedVersions.includes(card.version)) return false;

            // Slot type specific filters
            if (slotDef.type === 'mushi') {
                if (checkedSizes.length > 0) {
                    const strength = card.strength;
                    const size = (strength >= 180) ? '大型' : (strength >= 140) ? '中型' : '小型';
                    if (!checkedSizes.includes(size)) return false;
                }
                if (checkedSukumi.length > 0) {
                    const superSkillId = card.super_skill;
                    if (superSkillId) {
                        const superSkillWaza = wazaDataMap.get(superSkillId);
                        if (superSkillWaza) {
                            let sukumiType = '';
                            if (superSkillWaza.skill_type === 'rock') sukumiType = 'グー';
                            else if (superSkillWaza.skill_type === 'scissors') sukumiType = 'チョキ';
                            else if (superSkillWaza.skill_type === 'paper') sukumiType = 'パー';

                            if (!checkedSukumi.includes(sukumiType)) return false;
                        } else {
                            return false;
                        }
                    } else {
                        return false;
                    }
                }
                if (checkedPersonalities.length > 0 && !checkedPersonalities.includes(card.personality)) return false;
            } else if (slotDef.type === 'waza') {
                if (card.skill_type !== slotDef.skill) return false;
                if (checkedWazaProperties.length > 0) {
                    return checkedWazaProperties.some(property => {
                        if (property === 'compat') {
                            // This check is now implicitly handled by the pre-filter above
                            const mushiStrength = selectedCards.mushi.strength;
                            const tech = card.technique;
                            if (typeof tech !== 'number') return false;
                            let expectedTech = (mushiStrength >= 180) ? 20 : (mushiStrength >= 140) ? 50 : 80;
                            return tech === expectedTech;
                        }
                        if (property === 'special') {
                            return typeof card.technique !== 'number';
                        }
                        return false;
                    });
                }
            }
            return true;
        });

        // --- Sorting Logic ---
        if (sortState.key) {
            filteredCards.sort((a, b) => {
                const valA = a[sortState.key] || '';
                const valB = b[sortState.key] || '';
                const direction = sortState.direction === 'asc' ? 1 : -1;

                if (typeof valA === 'number' && typeof valB === 'number') {
                    return (valA - valB) * direction;
                } else {
                    return valA.toString().localeCompare(valB.toString()) * direction;
                }
            });
        }

        // --- Render List ---
        filteredCards.forEach(card => {
            const cardElement = document.createElement('div');
            cardElement.className = 'card-item';
            cardElement.addEventListener('click', () => onCardSelect(card));

            headers.forEach(header => {
                const fieldElement = document.createElement('div');
                fieldElement.className = `card-field ${header.className}`;
                fieldElement.textContent = card[header.key] || '-';
                cardElement.appendChild(fieldElement);
            });
            cardList.appendChild(cardElement);
        });
    }
    
    function getCheckedValues(name) {
        return [...document.querySelectorAll(`input[name="${name}"]:checked`)].map(el => el.value);
    }

    function onCardSelect(card) {
        if (!activeSlotId) return;
        selectedCards[activeSlotId] = card;
        updateSlotDisplay(activeSlotId);
        
        const oldSlotId = activeSlotId;
        activeSlotId = null;
        document.getElementById(`slot-${oldSlotId}`).classList.remove('active');
        
        updateFilterVisibility();
        updateCardList();
        updateGenerateButtonState();
        checkSuperSkillSelection();
        checkTechniqueMismatch();
    }

    function onCardRemove(slotId) {
        selectedCards[slotId] = null;
        updateSlotDisplay(slotId);
        updateGenerateButtonState();
        checkSuperSkillSelection();
        checkTechniqueMismatch();

        if (slotId === 'mushi') {
            updateCardList();
        }
    }

    function updateSlotDisplay(slotId) {
        const slot = document.getElementById(`slot-${slotId}`);
        const card = selectedCards[slotId];
        const slotDef = slotDefinitions[slotId];
        slot.innerHTML = '';

        if (card) {
            slot.textContent = card.name;
            slot.classList.add('filled');
            const removeBtn = document.createElement('span');
            removeBtn.className = 'remove-btn';
            removeBtn.textContent = ' (×)';
            removeBtn.onclick = (e) => {
                e.stopPropagation();
                onCardRemove(slotId);
            };
            slot.appendChild(removeBtn);
        } else {
            slot.textContent = slotDef.label;
            slot.classList.remove('filled');
        }
    }

    function updateGenerateButtonState() {
        const anyCardSelected = Object.values(selectedCards).some(card => card !== null);
        generateBtn.disabled = !anyCardSelected;
    }

    generateBtn.addEventListener('click', () => {
        const selectedIds = Object.values(selectedCards)
            .filter(card => card !== null)
            .map(card => card.internal_id);
        if (selectedIds.length > 0) {
            window.location.href = `barcode.html?cards=${selectedIds.join(',')}`;
        }
    });

    function checkSuperSkillSelection() {
        alertContainer.innerHTML = '';
        const mushi = selectedCards.mushi;
        if (!mushi) return;

        const selectedWazaIds = new Set([selectedCards.waza_rock, selectedCards.waza_scissors, selectedCards.waza_paper]
            .filter(w => w !== null)
            .map(w => w.internal_id));

        const superSkillId = mushi.super_skill;
        const ultimateSkillId = mushi.ultimate_skill;

        const isSuperSkillPresent = superSkillId && wazaDataMap.has(superSkillId);
        const isUltimateSkillPresent = ultimateSkillId && wazaDataMap.has(ultimateSkillId);

        const isSuperSelected = isSuperSkillPresent ? selectedWazaIds.has(superSkillId) : false;
        const isUltimateSelected = isUltimateSkillPresent ? selectedWazaIds.has(ultimateSkillId) : false;

        if (isSuperSkillPresent && !isSuperSelected && (!isUltimateSkillPresent || !isUltimateSelected)) {
            createAlert('超必殺技が選択されていません。クリックして自動設定します。', () => setSkill(superSkillId));
        }

        if (isUltimateSkillPresent && !isUltimateSelected) {
            createAlert('究極必殺技が選択されていません。クリックして自動設定します。', () => setSkill(ultimateSkillId));
        }
    }

    function createAlert(message, onClick) {
        const alertMsg = document.createElement('div');
        alertMsg.className = 'alert-message';
        alertMsg.textContent = message;
        alertMsg.onclick = onClick;
        alertContainer.appendChild(alertMsg);
    }

    function setSkill(skillId) {
        const skillCard = wazaDataMap.get(skillId);
        if (!skillCard) return;

        let targetSlotId = `waza_${skillCard.skill_type}`;

        if (targetSlotId) {
            selectedCards[targetSlotId] = skillCard;
            updateSlotDisplay(targetSlotId);
            checkSuperSkillSelection();
            checkTechniqueMismatch();
        }
    }

    function checkTechniqueMismatch() {
        const mushi = selectedCards.mushi;
        if (!mushi) return;

        let expectedTech = (mushi.strength >= 180) ? 20 : (mushi.strength >= 140) ? 50 : 80;

        ['waza_rock', 'waza_scissors', 'waza_paper'].forEach(slotId => {
            const waza = selectedCards[slotId];
            if (waza && typeof waza.technique === 'number' && waza.technique !== expectedTech) {
                createAlert(
                    `${waza.name}(テクニック:${waza.technique})は、${mushi.name}(テクニック:${expectedTech})と相性が良くありません。クリックで解除できます。`,
                    () => onCardRemove(slotId)
                );
            }
        });
    }

    initializeApp();
});
