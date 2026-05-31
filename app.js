// =========================================================
        // JavaScript 核心逻辑 (Version 20.0)
        // =========================================================

        if (typeof pdfjsLib !== 'undefined') {
            pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        }

        let quizData = [];
        let userAnswers = [];
        let currentQuestionIndex = 0;
        let seconds = 0;
        let timerInterval = null;
        let isExamFinished = false;
        let isCardVisible = false;
        let currentQuizName = null;
        let currentQuizHash = null;
        let appState = 'Home';
        let isMemorizeMode = false;
        // V15.0: 拆分乱序控制为两个独立开关
        let isShuffleQuestions = true;
        let isShuffleOptions = true;
        // V15.0: 背题模式答对自动跳转
        let isAutoAdvance = false;
        let autoAdvanceTimer = null;
        let isWrongReinsert = false;
        var _wrongQueue = null;
        var isCurrentCardHidden = localStorage.getItem('PREF_isCurrentCardHidden') === 'true';
        var isHistoryHidden = localStorage.getItem('PREF_isHistoryHidden') === 'true';
        // V17.0: 设置抽屉状态 & 题库列表折叠状态
        let isDrawerOpen = false;
        let isQuizListCollapsed = false;

        const HISTORY_LIMIT = 5;
        const QUIZ_LIST_KEY = 'QUIZ_LIST_V8_5';
        const SETTINGS_KEY = 'SETTINGS_V20';

        const timeDisplay = document.getElementById('time-display');
        const submitBtn = document.getElementById('submit-quiz-btn');
        const homePage = document.getElementById('home-page');
        const quizArea = document.getElementById('quiz-area');
        const statsPage = document.getElementById('stats-page');
        const currentQuizDisplay = document.getElementById('quiz-title');
        const quizListContainer = document.getElementById('quiz-list-container');
        const questionDisplayArea = document.getElementById('question-display-area');
        const cardGrid = document.getElementById('card-grid');
        const answerCardArea = document.getElementById('answer-card-area');
        const resultSummaryDiv = document.getElementById('exam-result-summary');
        const cardToggleButton = document.getElementById('answer-sheet-btn');
        const bottomNav = document.getElementById('bottom-nav');
        const lastScoreDisplay = document.getElementById('last-score');
        const historyListContent = document.getElementById('history-list-content');
        const loadingOverlay = document.getElementById('loading-overlay');
        const loadingText = document.getElementById('loading-text');
        const memorizeBanner = document.getElementById('memorize-banner');
        // V17.0 新增元素
        const settingsDrawer = document.getElementById('settings-drawer');
        const drawerOverlay = document.getElementById('drawer-overlay');
        const settingsGearBtn = document.getElementById('settings-gear-btn');
        const quizListScrollWrapper = document.getElementById('quiz-list-scroll-wrapper');
        const quizListCollapseBar = document.getElementById('quiz-list-collapse-bar');
        const quizListCollapseBtn = document.getElementById('quiz-list-collapse-btn');
        const quizListCollapseText = document.getElementById('quiz-list-collapse-text');

        // =========================================================
        // A. V20.0: 设置持久化（LocalStorage 读写）
        // =========================================================

        function saveSettings() {
            var settings = {
                isMemorizeMode: isMemorizeMode,
                isShuffleQuestions: isShuffleQuestions,
                isShuffleOptions: isShuffleOptions,
                isAutoAdvance: isAutoAdvance,
                isWrongReinsert: isWrongReinsert
            };
            try {
                localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
            } catch(e) {
                console.error('保存设置失败:', e);
            }
        }

        function loadSettings() {
            try {
                var saved = localStorage.getItem(SETTINGS_KEY);
                if (saved) {
                    var settings = JSON.parse(saved);
                    if (typeof settings.isMemorizeMode === 'boolean') isMemorizeMode = settings.isMemorizeMode;
                    if (typeof settings.isShuffleQuestions === 'boolean') isShuffleQuestions = settings.isShuffleQuestions;
                    if (typeof settings.isShuffleOptions === 'boolean') isShuffleOptions = settings.isShuffleOptions;
                    if (typeof settings.isAutoAdvance === 'boolean') isAutoAdvance = settings.isAutoAdvance;
                    if (typeof settings.isWrongReinsert === 'boolean') isWrongReinsert = settings.isWrongReinsert;
                }
            } catch(e) {
                console.error('加载设置失败:', e);
            }
        }

        function applySettingsToUI() {
            // 同步模式选择器
            var modeNormal = document.getElementById('mode-normal');
            var modeMemorize = document.getElementById('mode-memorize');

            if (isMemorizeMode) {
                if (modeMemorize) modeMemorize.checked = true;
                if (modeNormal) modeNormal.checked = false;
                if (modeMemorize) {
                    var optM = modeMemorize.closest('.mode-option');
                    if (optM) optM.classList.add('selected');
                }
                if (modeNormal) {
                    var optN = modeNormal.closest('.mode-option');
                    if (optN) optN.classList.remove('selected');
                }
            } else {
                if (modeNormal) modeNormal.checked = true;
                if (modeMemorize) modeMemorize.checked = false;
                if (modeNormal) {
                    var optN2 = modeNormal.closest('.mode-option');
                    if (optN2) optN2.classList.add('selected');
                }
                if (modeMemorize) {
                    var optM2 = modeMemorize.closest('.mode-option');
                    if (optM2) optM2.classList.remove('selected');
                }
            }

            // 同步三个开关
            var qToggle = document.getElementById('shuffle-questions-toggle');
            var oToggle = document.getElementById('shuffle-options-toggle');
            var aToggle = document.getElementById('auto-advance-toggle');

            if (qToggle) {
                if (isShuffleQuestions) qToggle.classList.add('active');
                else qToggle.classList.remove('active');
            }
            if (oToggle) {
                if (isShuffleOptions) oToggle.classList.add('active');
                else oToggle.classList.remove('active');
            }
            if (aToggle) {
                if (isAutoAdvance) aToggle.classList.add('active');
                else aToggle.classList.remove('active');
            }
            var wToggle = document.getElementById('wrong-reinsert-toggle');
            if (wToggle) {
                if (isWrongReinsert) wToggle.classList.add('active');
                else wToggle.classList.remove('active');
            }
        }

        // =========================================================
        // A2. 安全与通知工具函数 (V20.1)
        // =========================================================

        /** HTML 实体转义 — 所有用户数据进入 innerHTML 前必须过此函数 */
        function escapeHtml(str) {
            if (str == null) return '';
            return String(str)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        }

        /** JS 字符串字面量转义 — onclick 等属性中嵌入用户数据时使用 */
        function escapeJsStr(str) {
            if (str == null) return '';
            return String(str)
                .replace(/\\/g, '\\\\')
                .replace(/'/g, "\\'")
                .replace(/\n/g, '\\n')
                .replace(/\r/g, '');
        }

        /** 轻量 toast 通知 — 页面顶部浮现后自动消失 */
        function showToast(msg, type) {
            type = type || 'info';
            var container = document.getElementById('toast-container');
            if (!container) return;
            var el = document.createElement('div');
            el.className = 'toast-item toast-' + type;
            el.textContent = msg;
            container.appendChild(el);
            el.addEventListener('animationend', function(e) {
                if (e.animationName === 'toastOut') {
                    if (el.parentNode) el.parentNode.removeChild(el);
                }
            });
        }

        // =========================================================
        // B. 状态管理与通用工具函数
        // =========================================================

        function showLoading(text) {
            loadingText.textContent = text || '正在解析文件...';
            loadingOverlay.style.display = 'flex';
        }

        function hideLoading() {
            loadingOverlay.style.display = 'none';
        }

        // V20.0: 底部导航栏切换处理（无声暂停与恢复，无任何遮罩层）
        window.handleNavClick = function(element) {
            var newState = element.dataset.state;

            if (newState === 'Home') {
                setAppState('Home');
            } else if (newState === 'Quiz') {
                if (quizData.length === 0) {
                    alert("请先在首页导入或选择一个题库进行练习！");
                    setAppState('Home');
                } else {
                    // 静默恢复：直接切回作答现场
                    setAppState(isExamFinished ? 'Review' : 'Quiz');
                }
            } else if (newState === 'Stats') {
                setAppState('Stats');
            }
        };

        window.setAppState = function(newState) {
            // V20.0: 切离作答区时静默保存进度（无视觉弹窗）
            if ((appState === 'Quiz' || appState === 'Review') &&
                newState !== 'Quiz' && newState !== 'Review' &&
                !isExamFinished && quizData.length > 0 && currentQuizName) {
                saveActiveProgress();
            }

            appState = newState;
            stopTimer();
            clearAutoAdvanceTimer();
            window.scrollTo(0, 0);

            homePage.style.display = 'none';
            quizArea.style.display = 'none';
            statsPage.style.display = 'none';

            document.querySelectorAll('.nav-item').forEach(function(item) {
                item.classList.remove('active');
                if (item.dataset.state === newState) {
                    item.classList.add('active');
                }
                // 确保练习按钮在 Quiz/Review 状态下高亮
                if ((newState === 'Quiz' || newState === 'Review') && item.dataset.state === 'Quiz') {
                    item.classList.add('active');
                }
            });

            var isMobile = window.innerWidth <= 768;
            answerCardArea.style.position = isMobile ? 'fixed' : 'sticky';

            var swipeHint = document.getElementById('swipe-hint');
            if (swipeHint) swipeHint.style.display = 'none';

            if (newState === 'Home') {
                homePage.style.display = 'block';
                answerCardArea.classList.remove('visible');
                isCardVisible = false;
                renderHomePage();
            } else if (newState === 'Quiz' || newState === 'Review') {
                quizArea.style.display = 'block';
                currentQuizDisplay.textContent = currentQuizName || '正在答题';

                submitBtn.style.display = newState === 'Quiz' ? 'block' : 'none';
                if (isMemorizeMode) {
                    memorizeBanner.style.display = 'flex';
                } else {
                    memorizeBanner.style.display = 'none';
                }

                if (isMobile) {
                    answerCardArea.classList.remove('visible');
                    isCardVisible = false;
                }

                if (swipeHint && newState === 'Quiz') swipeHint.style.display = 'block';

                initQuizUI();
            } else if (newState === 'Stats') {
                statsPage.style.display = 'block';
                answerCardArea.classList.remove('visible');
                isCardVisible = false;
                renderStatsPage();
            }
        };

        function shuffleArray(array) {
            var shuffled = array.slice();
            for (var i = shuffled.length - 1; i > 0; i--) {
                var j = Math.floor(Math.random() * (i + 1));
                var temp = shuffled[i];
                shuffled[i] = shuffled[j];
                shuffled[j] = temp;
            }
            return shuffled;
        }

        function checkAnswer(questionData, userAnswer) {
            if (!userAnswer) return false;
            if (questionData.type.indexOf('多选') !== -1) {
                var userSorted = (Array.isArray(userAnswer) ? userAnswer.slice().sort().join('') : userAnswer.split('').sort().join(''));
                var keySorted = questionData.answerKey.split('').sort().join('');
                return userSorted === keySorted;
            } else {
                return userAnswer === questionData.answerKey;
            }
        }

        function hasAnswered(answer) {
            return Array.isArray(answer) ? answer.length > 0 : answer !== null;
        }

        window.autoLocateProgress = function() {
            if (!userAnswers || userAnswers.length === 0) return;
            var lastAnsweredIdx = 0;
            for (var i = 0; i < userAnswers.length; i++) {
                if (hasAnswered(userAnswers[i])) lastAnsweredIdx = i;
            }
            currentQuestionIndex = lastAnsweredIdx;
        };

        /**
         * 为题目数组中的每道题生成 shuffledOptions（基于原始 options 的乱序副本）。
         */
        function initializeQuestionOptions(questions) {
            questions.forEach(function(q) {
                q.shuffledOptions = shuffleArray(q.options.slice());
            });
            return questions;
        }

        // =========================================================
        // V17.0: 设置抽屉开关
        // =========================================================
        window.toggleSettingsDrawer = function() {
            isDrawerOpen = !isDrawerOpen;
            if (isDrawerOpen) {
                settingsDrawer.classList.add('visible');
                drawerOverlay.classList.add('visible');
                settingsGearBtn.classList.add('spinning');
                setTimeout(function() { settingsGearBtn.classList.remove('spinning'); }, 600);
                document.body.style.overflow = 'hidden';
            } else {
                settingsDrawer.classList.remove('visible');
                drawerOverlay.classList.remove('visible');
                document.body.style.overflow = '';
            }
        };

        // =========================================================
        // V17.0: 题库列表折叠/展开
        // =========================================================
        window.toggleQuizListCollapse = function() {
            isQuizListCollapsed = !isQuizListCollapsed;
            var bar = document.getElementById('quiz-list-collapse-bar');
            var btn = document.getElementById('quiz-list-collapse-btn');
            var wrapper = document.getElementById('quiz-list-scroll-wrapper');
            if (isQuizListCollapsed) {
                wrapper.classList.add('collapsed');
                bar.style.borderTop = 'none'; bar.style.paddingTop = '0';
                btn.style.width = '100%'; btn.style.justifyContent = 'center';
                btn.style.background = '#F0F4F8'; btn.style.padding = '14px'; btn.style.border = 'none'; btn.style.color = 'var(--color-primary)';
                btn.innerHTML = '<span style="font-weight:bold;font-size:1.05em;">点击展开</span>';
            } else {
                wrapper.classList.remove('collapsed');
                bar.style.borderTop = '1px dashed var(--color-border-light)'; bar.style.paddingTop = '10px';
                btn.style.width = 'auto'; btn.style.justifyContent = 'center';
                btn.style.background = '#fff'; btn.style.padding = '6px 16px'; btn.style.border = '1px solid var(--color-border-light)'; btn.style.color = 'var(--color-text-secondary)';
                btn.innerHTML = '<span class="material-icons">unfold_less</span><span id="quiz-list-collapse-text">收起</span>';
            }
        };

        // =========================================================
        // V20.0: 统计页折叠卡片切换
        // =========================================================
        window.toggleAccordion = function(header) {
            var accordion = header.parentElement;
            var body = accordion.querySelector('.stats-accordion-body');
            if (accordion.classList.contains('open')) {
                body.style.maxHeight = body.scrollHeight + 'px';
                accordion.offsetHeight;
                accordion.classList.remove('open');
                body.style.maxHeight = '0px';
                body.addEventListener('transitionend', function h(){
                    body.removeEventListener('transitionend', h);
                    if (!accordion.classList.contains('open')) { body.style.maxHeight = ''; }
                });
            } else {
                accordion.classList.add('open');
                var targetHeight = body.scrollHeight + 20;
                var finalHeight = targetHeight > 320 ? 320 : targetHeight;
                body.style.maxHeight = finalHeight + 'px';
                body.addEventListener('transitionend', function h(){
                    body.removeEventListener('transitionend', h);
                    if (accordion.classList.contains('open')) { body.style.maxHeight = '320px'; }
                });
            }
        };

        window.clearQuizStats = function(quizName, quizHash) {
            if (!confirm('确定删除题库\u300c' + quizName + '\u300d的全部历史记录吗？此操作不可逆！')) return;
            var p1 = 'HISTORY_' + quizName + '_' + quizHash;
            var p2 = p1 + '_SPLIT_';
            for (var k = 0; k < localStorage.length; k++) {
                var lk = localStorage.key(k);
                if (lk && (lk.indexOf(p2) === 0 || lk === p1)) localStorage.removeItem(lk);
            }
            renderStatsPage();
        };

        window.openQuizPicker = function() {
            if (!document.getElementById('picker-dynamic-styles')) {
                var style = document.createElement('style');
                style.id = 'picker-dynamic-styles';
                style.textContent = '.picker-item{display:flex;align-items:center;justify-content:space-between;padding:14px 12px;border-bottom:1px solid rgba(0,0,0,0.04);cursor:pointer;transition:background 0.2s;}.picker-item:active{background-color:#F5F5F7;}.picker-item-left{display:flex;align-items:center;gap:10px;flex-grow:1;}.picker-title{font-weight:600;font-size:0.95em;color:var(--color-text-main);}.picker-meta{font-size:0.75em;color:var(--color-text-secondary);margin-top:2px;}.picker-delete-btn{background:transparent;border:none;color:var(--color-text-secondary);cursor:pointer;padding:4px;display:flex;align-items:center;}.picker-delete-btn:hover{color:var(--color-wrong);}';
                document.head.appendChild(style);
            }

            if (!document.getElementById('quiz-picker-drawer')) {
                var overlay = document.createElement('div');
                overlay.id = 'picker-overlay';
                overlay.onclick = closeQuizPicker;
                overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.4);z-index:2500;opacity:0;visibility:hidden;transition:all 0.3s ease;';
                document.body.appendChild(overlay);
                var drawer = document.createElement('div');
                drawer.id = 'quiz-picker-drawer';
                drawer.style.cssText = 'position:fixed;bottom:0;left:0;width:100%;max-height:65vh;background:#FFFFFF;z-index:2600;border-radius:20px 20px 0 0;box-shadow:0 -10px 40px rgba(0,0,0,0.15);box-sizing:border-box;padding:16px;transform:translateY(100%);transition:transform 0.35s cubic-bezier(0.25,1,0.5,1);overflow-y:auto;';
                drawer.innerHTML = '<div style=\"width:36px;height:4px;background:#E5E5EA;border-radius:2px;margin:0 auto 16px;\"></div><h3 style=\"margin:0 0 12px 4px;font-size:1.05em;font-weight:700;color:var(--color-text-main);display:flex;align-items:center;gap:6px;\"><span class=\"material-icons\" style=\"font-size:20px;\">list</span>\u9009\u62e9\u9898\u5e93</h3><div id=\"picker-list-content\"></div>';
                document.body.appendChild(drawer);
            }

            var quizList = getQuizList();
            var listContent = document.getElementById('picker-list-content');
            listContent.innerHTML = '';

            if (typeof isCurrentCardHidden === 'undefined') { isCurrentCardHidden = false; }

            var hideItem = document.createElement('div');
            hideItem.className = 'picker-item';
            hideItem.style.background = '#FAFAFC';
            if (typeof appState !== 'undefined' && appState === 'Stats') {
                hideItem.innerHTML = '<div class=\"picker-item-left\"><span class=\"material-icons\" style=\"color:var(--color-text-secondary);font-size:20px;\">visibility_off</span><div class=\"picker-title\" style=\"color:var(--color-text-secondary);font-weight:500;\">\u9690\u85cf\u5386\u53f2\u8bb0\u5f55</div></div>';
                hideItem.onclick = function() { isHistoryHidden = true; localStorage.setItem('PREF_isHistoryHidden','true'); closeQuizPicker(); renderStatsPage(); };
            } else {
                hideItem.innerHTML = '<div class=\"picker-item-left\"><span class=\"material-icons\" style=\"color:var(--color-text-secondary);font-size:20px;\">visibility_off</span><div class=\"picker-title\" style=\"color:var(--color-text-secondary);font-weight:500;\">\u9690\u85cf\u9898\u5e93</div></div>';
                hideItem.onclick = function() { isCurrentCardHidden = true; localStorage.setItem('PREF_isCurrentCardHidden','true'); closeQuizPicker(); renderHomePage(); };
            }
            listContent.appendChild(hideItem);

            quizList.forEach(function(quiz, index) {
                var item = document.createElement('div');
                item.className = 'picker-item';
                var sNameJs = escapeJsStr(quiz.name);
                var sHashJs = escapeJsStr(quiz.hash);
                item.innerHTML = '<div class=\"picker-item-left\"><span class=\"material-icons\" style=\"color:var(--color-primary);font-size:20px;\">description</span><div><div class=\"picker-title\">' + escapeHtml(quiz.name) + '</div><div class=\"picker-meta\">\u603b\u9898\u6570: ' + quiz.questionCount + '</div></div></div><button class=\"picker-delete-btn\" onclick=\"event.stopPropagation();deleteQuizFromPicker(\'' + sNameJs + '\',\'' + sHashJs + '\')\"><span class=\"material-icons\" style=\"font-size:18px;\">delete</span></button>';
                item.onclick = function() {
                    var list = getQuizList();
                    for (var di = 0; di < list.length; di++) {
                        if (list[di].name === quiz.name && list[di].hash === quiz.hash) {
                            var target = list.splice(di, 1)[0];
                            list.unshift(target);
                            break;
                        }
                    }
                    localStorage.setItem(QUIZ_LIST_KEY, JSON.stringify(list));
                    closeQuizPicker();
                    if (appState === 'Home') { isCurrentCardHidden = false; localStorage.setItem('PREF_isCurrentCardHidden','false'); renderHomePage(); }
                    else if (appState === 'Stats') { isHistoryHidden = false; localStorage.setItem('PREF_isHistoryHidden','false'); renderStatsPage(); }
                };
                listContent.appendChild(item);
            });

            var overlay = document.getElementById('picker-overlay');
            var drawer = document.getElementById('quiz-picker-drawer');
            overlay.style.visibility = 'visible';
            overlay.style.opacity = '1';
            drawer.style.transform = 'translateY(0)';
        };

        window.closeQuizPicker = function() {
            var overlay = document.getElementById('picker-overlay');
            var drawer = document.getElementById('quiz-picker-drawer');
            if (overlay) { overlay.style.opacity = '0'; setTimeout(function() { overlay.style.visibility = 'hidden'; }, 300); }
            if (drawer) { drawer.style.transform = 'translateY(100%)'; }
        };

        window.deleteQuizFromPicker = function(name, hash) {
            if (!confirm('确定删除题库\u300c' + name + '\u300d吗？')) return;
            localStorage.removeItem('PROGRESS_' + name + '_' + hash);
            localStorage.removeItem('HISTORY_' + name + '_' + hash);
            var list = getQuizList();
            if (list[0] && list[0].name === name && list[0].hash === hash) { isCurrentCardHidden = false; }
            var target = list.find(function(q) { return q.name === name && q.hash === hash; });
            if (target) { try { localStorage.removeItem(target.dataKey); } catch(e){} try { _idb.del(target.dataKey); } catch(e){} }
            list = list.filter(function(q) { return !(q.name === name && q.hash === hash); });
            localStorage.setItem(QUIZ_LIST_KEY, JSON.stringify(list));
            openQuizPicker();
            renderHomePage();
        };

        window.clearAllHistoryOfQuiz = function(name, hash) {
            if (!confirm('确定要清空题库\u300c' + name + '\u300d的所有答题历史记录吗？\n此操作将不可恢复！')) return;
            localStorage.removeItem('HISTORY_' + name + '_' + hash);
            renderStatsPage();
        };

        // =========================================================
        // V20.0: 模式选择（含持久化）
        // =========================================================

        window.selectMode = function(element, mode) {
            var options = document.querySelectorAll('.mode-option');
            options.forEach(function(opt) { opt.classList.remove('selected'); });
            element.classList.add('selected');
            var radio = element.querySelector('input[type="radio"]');
            if (radio) radio.checked = true;
            isMemorizeMode = (mode === 'memorize');
            saveSettings();
        };

        // V20.0: 三个独立开关的切换（含持久化）
        window.toggleShuffleQuestions = function() {
            isShuffleQuestions = !isShuffleQuestions;
            var toggleEl = document.getElementById('shuffle-questions-toggle');
            if (isShuffleQuestions) {
                toggleEl.classList.add('active');
            } else {
                toggleEl.classList.remove('active');
            }
            saveSettings();
        };

        window.toggleShuffleOptions = function() {
            isShuffleOptions = !isShuffleOptions;
            var toggleEl = document.getElementById('shuffle-options-toggle');
            if (isShuffleOptions) {
                toggleEl.classList.add('active');
            } else {
                toggleEl.classList.remove('active');
            }
            saveSettings();
        };

        window.toggleAutoAdvance = function() {
            isAutoAdvance = !isAutoAdvance;
            var toggleEl = document.getElementById('auto-advance-toggle');
            if (isAutoAdvance) {
                toggleEl.classList.add('active');
            } else {
                toggleEl.classList.remove('active');
                clearAutoAdvanceTimer();
            }
            saveSettings();
        };

        window.toggleWrongReinsert = function() {
            isWrongReinsert = !isWrongReinsert;
            var toggleEl = document.getElementById('wrong-reinsert-toggle');
            if (!toggleEl) return;
            if (isWrongReinsert) toggleEl.classList.add('active');
            else { toggleEl.classList.remove('active'); _wrongQueue = null; }
            saveSettings();
        };

        var THEME_COLORS = [
            { primary:'#C75B39', a:'#7A9A7E', b:'#E8A840' },
            { primary:'#C57353', a:'#8C7369', b:'#D89B7D' },
            { primary:'#5E798F', a:'#8E9CA8', b:'#99ABC0' },
            { primary:'#B56C78', a:'#C2959B', b:'#D4A3AB' },
            { primary:'#5B7A61', a:'#859C88', b:'#A0B29F' }
        ];
        window.setTheme = function(idx) {
            var t = THEME_COLORS[idx];
            var r = document.querySelector(':root');
            r.style.setProperty('--color-primary', t.primary);
            r.style.setProperty('--color-accent-a', t.a);
            r.style.setProperty('--color-accent-b', t.b);
            var dots = document.querySelectorAll('#palette-popup .palette-dot');
            for (var di = 0; di < dots.length; di++) dots[di].classList.toggle('active', di === idx);
            try { localStorage.setItem('THEME_INDEX', idx); } catch(e) {}
            document.getElementById('palette-popup').style.display = 'none';
        };
        window.togglePalettePopup = function() {
            var p = document.getElementById('palette-popup');
            p.style.display = p.style.display === 'flex' ? 'none' : 'flex';
        };
        (function(){
            try { var ti = parseInt(localStorage.getItem('THEME_INDEX')); if (ti >= 0 && ti < THEME_COLORS.length) setTheme(ti); } catch(e) {}
        })();

        var _splitQuizName = null, _splitQuizHash = null, _splitQuizCount = 0;
        window.showSplitModal = function(qn, qh, cnt) {
            _splitQuizName = qn; _splitQuizHash = qh; _splitQuizCount = cnt;
            document.getElementById('split-modal-quiz-name').textContent = qn + ' (' + cnt + ' 题)';
            document.getElementById('split-start').max = cnt; document.getElementById('split-end').max = cnt;
            document.getElementById('split-start').value = ''; document.getElementById('split-end').value = '';

            var spPrefix = 'PROGRESS_' + qn + '_' + qh + '_SPLIT_';
            var lastSplit = null, lastTime = '', lastRange = '';
            for (var i = 0; i < localStorage.length; i++) {
                var k = localStorage.key(i);
                if (k && k.indexOf(spPrefix) === 0) {
                    try {
                        var d = JSON.parse(localStorage.getItem(k));
                        if (d && d.timestamp > lastTime) {
                            lastTime = d.timestamp;
                            lastRange = k.replace(spPrefix, '');
                            var ansCnt = d.userAnswers ? d.userAnswers.filter(hasAnswered).length : 0;
                            var totCnt = d.userAnswers ? d.userAnswers.length : 0;
                            lastSplit = '上次拆分: ' + lastRange + ' 题 (已答 ' + ansCnt + '/' + totCnt + ')';
                        }
                    } catch(e){}
                }
            }

            var hintEl = document.getElementById('split-modal-hint');
            if (!hintEl) {
                hintEl = document.createElement('div');
                hintEl.id = 'split-modal-hint';
                hintEl.style.cssText = 'font-size:0.85em;color:var(--color-text-secondary);margin-bottom:12px;background:rgba(0,0,0,0.03);padding:8px;border-radius:8px;text-align:center;';
                var nameEl = document.getElementById('split-modal-quiz-name');
                nameEl.parentNode.insertBefore(hintEl, nameEl.nextSibling);
            }
            if (lastSplit) {
                hintEl.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;"><span>' + lastSplit + '</span><button onclick="resumeSplitQuiz(\'' + lastRange + '\')" style="padding:6px 14px;border:none;border-radius:8px;background:var(--color-primary);color:#fff;font-size:0.9em;font-weight:bold;cursor:pointer;box-shadow:0 2px 6px rgba(0,0,0,0.1);">继续</button></div>';
                hintEl.style.display = 'block';
            } else { hintEl.style.display = 'none'; }

            document.getElementById('split-modal-overlay').style.display = 'flex';
        };
        window.closeSplitModal = function() { document.getElementById('split-modal-overlay').style.display = 'none'; };
        window.resumeSplitQuiz = function(rangeStr) {
            var parts = rangeStr.split('-');
            if (parts.length === 2) {
                document.getElementById('split-start').value = parts[0];
                document.getElementById('split-end').value = parts[1];
                document.getElementById('split-end').closest('div').querySelector('button.btn-secondary').click();
            }
        };
        window.startSplitQuiz = function() {
            var ql = getQuizList();
            var tq = ql.find(function(q){return q.name===_splitQuizName&&q.hash===_splitQuizHash;});
            if(!tq){alert('找不到该题库');return;}
            var si = parseInt(document.getElementById('split-start').value)||1;
            var ei = parseInt(document.getElementById('split-end').value)||_splitQuizCount;
            if(si<1)si=1; if(ei>_splitQuizCount)ei=_splitQuizCount;
            if(si>ei){alert('起始题号不能大于结束题号');return;}
            closeSplitModal();
            var raw = localStorage.getItem(tq.dataKey);
            var cb = function(text){
                var fd = parseQuizText(text); var sl = fd.slice(si-1, ei);
                currentQuizName = _splitQuizName; currentQuizHash = _splitQuizHash + '_SPLIT_' + si + '-' + ei; currentQuestionIndex = 0;
                var pk = 'PROGRESS_' + currentQuizName + '_' + currentQuizHash;
                var sp = localStorage.getItem(pk);
                if(sp){try{var dp=JSON.parse(sp);quizData=dp.quizData;userAnswers=dp.userAnswers;seconds=dp.seconds||0;}catch(e){}}
                else { quizData=sl; if(isShuffleQuestions)quizData=shuffleArray(quizData); if(isShuffleOptions)quizData=initializeQuestionOptions(quizData); else quizData.forEach(function(q){if(!q.shuffledOptions)q.shuffledOptions=q.options.slice();}); userAnswers=new Array(quizData.length).fill(null).map(function(_,i){return quizData[i].type.indexOf('多选')!==-1?[]:null;}); seconds=0; }
                if (window.autoLocateProgress) window.autoLocateProgress();
                isExamFinished=false; _wrongQueue=null;
                if(isMemorizeMode&&isWrongReinsert){_wrongQueue=[];for(var qi=0;qi<quizData.length;qi++)_wrongQueue.push(qi);}
                if(isDrawerOpen)toggleSettingsDrawer(); setAppState('Quiz');
            };
            if(!raw){showLoading('正在加载');_idb.get(tq.dataKey).then(function(d){hideLoading();if(d)cb(d);else alert('加载失败');}).catch(function(){hideLoading();alert('加载失败');});}
            else cb(raw);
        };

        // =========================================================
        // C. 题库、进度与历史管理
        // =========================================================

        function generateQuizHash(quizData) {
            if (!quizData || quizData.length === 0) return 'NO_DATA';
            var content = quizData.slice(0, 10).map(function(q) {
                var indexPart = q.originalIndex !== undefined ? 'IDX_' + q.originalIndex : '';
                return indexPart + q.question.substring(0, 50) + q.answerKey;
            }).join('|');

            var hash = 0;
            for (var i = 0; i < content.length; i++) {
                var char = content.charCodeAt(i);
                hash = ((hash << 5) - hash) + char;
                hash |= 0;
            }
            return 'QZ_' + Math.abs(hash).toString(36);
        }

        function saveActiveProgress() {
            if (!currentQuizName || quizData.length === 0 || !currentQuizHash) return;
            try {
                var activeKey = 'PROGRESS_' + currentQuizName + '_' + currentQuizHash;
                var dataToSave = JSON.stringify({
                    quizData: quizData,
                    userAnswers: userAnswers,
                    seconds: seconds,
                    currentQuestionIndex: currentQuestionIndex,
                    timestamp: new Date().toISOString()
                });
                localStorage.setItem(activeKey, dataToSave);
            } catch (e) {
                console.error("保存活跃进度失败:", e);
                showToast('自动保存进度失败，存储空间可能不足', 'warn');
            }
        }

        function loadActiveProgress(quizName, hash) {
            if (!quizName || !hash) return false;
            try {
                var activeKey = 'PROGRESS_' + quizName + '_' + hash;
                var savedData = localStorage.getItem(activeKey);
                if (savedData) {
                    var data = JSON.parse(savedData);
                    quizData = data.quizData || [];
                    userAnswers = data.userAnswers || [];
                    seconds = data.seconds || 0;
                    currentQuestionIndex = data.currentQuestionIndex || 0;
                    isExamFinished = false;
                    return true;
                }
            } catch (e) {
                localStorage.removeItem('PROGRESS_' + quizName + '_' + hash);
            }
            return false;
        }

        function getQuizList() {
            try {
                var storedList = localStorage.getItem(QUIZ_LIST_KEY);
                return storedList ? JSON.parse(storedList) : [];
            } catch (e) {
                return [];
            }
        }

        var _idb = (function(){
            var db = null;
            function open(){ return new Promise(function(ok,no){ var r=indexedDB.open('shuati_db',1); r.onupgradeneeded=function(){ r.result.createObjectStore('raw'); }; r.onsuccess=function(){ db=r.result; ok(); }; r.onerror=function(){ no(r.error); }; }); }
            return {
                set: function(k,v){ return open().then(function(){ return new Promise(function(ok,no){ var t=db.transaction('raw','readwrite').objectStore('raw').put(v,k); t.onsuccess=ok; t.onerror=no; }); }); },
                get: function(k){ return open().then(function(){ return new Promise(function(ok,no){ var t=db.transaction('raw').objectStore('raw').get(k); t.onsuccess=function(){ ok(t.result); }; t.onerror=no; }); }); },
                del: function(k){ return open().then(function(){ return new Promise(function(ok,no){ var t=db.transaction('raw','readwrite').objectStore('raw').delete(k); t.onsuccess=ok; t.onerror=no; }); }); }
            };
        })();

        function saveQuizToList(name, rawText, parsedData) {
            try {
                var quizList = getQuizList();
                var hash = generateQuizHash(parsedData);
                var dataKey = 'RAW_DATA_' + name + '_' + hash;

                var existingIndex = quizList.findIndex(function(q) { return q.name === name; });

                if (existingIndex !== -1) {
                    var oldQuiz = quizList[existingIndex];
                    try { localStorage.removeItem(oldQuiz.dataKey); } catch(e){}
                    try { _idb.del(oldQuiz.dataKey); } catch(e){}
                    localStorage.removeItem('PROGRESS_' + oldQuiz.name + '_' + oldQuiz.hash);
                    localStorage.removeItem('HISTORY_' + oldQuiz.name + '_' + oldQuiz.hash);
                    quizList.splice(existingIndex, 1);
                }

                try { _idb.set(dataKey, rawText); } catch(e2) {
                    try { localStorage.setItem(dataKey, rawText); } catch(e3) {
                        showToast('保存失败，存储空间不足', 'error'); return;
                    }
                }

                quizList.unshift({
                    name: name,
                    hash: hash,
                    questionCount: parsedData.length,
                    dataKey: dataKey,
                    timestamp: new Date().toISOString()
                });

                localStorage.setItem(QUIZ_LIST_KEY, JSON.stringify(quizList));
            } catch (e) {
                showToast('保存题库失败，存储空间不足，请清理旧题库后重试', 'error');
            }
        }

        window.startQuiz = function(quizName, overrideHash) {
            clearAutoAdvanceTimer();

            if (isDrawerOpen) { toggleSettingsDrawer(); }

            var modeNormal = document.getElementById('mode-normal');
            isMemorizeMode = modeNormal ? !modeNormal.checked : false;

            var quizList = getQuizList();
            var targetQuiz = quizList.find(function(q) { return q.name === quizName; });

            if (!targetQuiz) { alert("找不到该题库，请重新导入。"); return; }

            currentQuizName = quizName;
            currentQuizHash = overrideHash || targetQuiz.hash;
            currentQuestionIndex = 0;

            var rawText = localStorage.getItem(targetQuiz.dataKey);

            if (!rawText) {
                showLoading('正在加载题库...');
                _idb.get(targetQuiz.dataKey).then(function(data){
                    hideLoading();
                    if (data) _startQuizWithRawText(quizName, targetQuiz, data, currentQuizHash);
                    else alert("错误：未能加载题库原始数据。");
                }).catch(function(){ hideLoading(); alert("错误：未能加载题库原始数据。"); });
                return;
            }

            _startQuizWithRawText(quizName, targetQuiz, rawText, currentQuizHash);
        };

        function _startQuizWithRawText(quizName, targetQuiz, rawText, actualHash) {
            currentQuizName = quizName;
            currentQuizHash = actualHash || targetQuiz.hash;
            currentQuestionIndex = 0;

            var loadedProgress = false;
            if (!loadActiveProgress(quizName, currentQuizHash)) {
                quizData = parseQuizText(rawText);
                userAnswers = new Array(quizData.length).fill(null).map(function(_, i) {
                    return quizData[i].type.indexOf('多选') !== -1 ? [] : null;
                });
                seconds = 0;
                if (isShuffleQuestions) quizData = shuffleArray(quizData);
                if (isShuffleOptions) quizData = initializeQuestionOptions(quizData);
                else quizData.forEach(function(q) { if (!q.shuffledOptions) q.shuffledOptions = q.options.slice(); });
            } else { loadedProgress = true; }
            if (window.autoLocateProgress) window.autoLocateProgress();

            isExamFinished = false;
            _wrongQueue = null;
            if (isMemorizeMode && isWrongReinsert) {
                _wrongQueue = [];
                for (var qi = 0; qi < quizData.length; qi++) _wrongQueue.push(qi);
            }
            setAppState('Quiz');
        };

        window.confirmRestartQuiz = function() {
            if (confirm("确定要重新开始当前题库的考试吗？所有未交卷的进度将被清除！")) {
                restartQuiz();
            }
        };

        function restartQuiz() {
            clearAutoAdvanceTimer();

            if (quizData.length === 0 || !currentQuizName) {
                alert("请先导入或选择题库文件。");
                return;
            }

            var quizList = getQuizList();
            var targetQuiz = quizList.find(function(q) { return q.name === currentQuizName && q.hash === currentQuizHash; });
            if (!targetQuiz) {
                alert("题库源文件丢失，请重新导入。");
                setAppState('Home');
                return;
            }
            var rawText = localStorage.getItem(targetQuiz.dataKey);
            var tempQuizData = parseQuizText(rawText);

            if (isShuffleQuestions) {
                quizData = shuffleArray(tempQuizData);
            } else {
                quizData = tempQuizData;
            }
            if (isShuffleOptions) {
                quizData = initializeQuestionOptions(quizData);
            } else {
                quizData.forEach(function(q) {
                    if (!q.shuffledOptions) {
                        q.shuffledOptions = q.options.slice();
                    }
                });
            }

            userAnswers = new Array(quizData.length).fill(null).map(function(_, index) {
                var qType = quizData[index].type;
                return qType && qType.indexOf('多选') !== -1 ? [] : null;
            });
            seconds = 0;
            currentQuestionIndex = 0;
            isExamFinished = false;

            localStorage.removeItem('PROGRESS_' + currentQuizName + '_' + currentQuizHash);

            initQuizUI();
            submitBtn.disabled = false;
            submitBtn.textContent = "交卷";
            setAppState('Quiz');
            if (window.innerWidth <= 768) toggleAnswerCard(false);
        }

        function saveHistory(answers, time) {
            if (!currentQuizName || !currentQuizHash) return;
            var baseHash = currentQuizHash.split('_SPLIT_')[0];
            var splitLabel = currentQuizHash.indexOf('_SPLIT_') !== -1 ? currentQuizHash.split('_SPLIT_')[1] : null;
            var historyKey = 'HISTORY_' + currentQuizName + '_' + baseHash;
            var history = [];
            try { var savedHistory = localStorage.getItem(historyKey); if (savedHistory) history = JSON.parse(savedHistory); } catch (e) {}
            var newRecord = {
                userAnswers: answers, seconds: time, splitLabel: splitLabel,
                quizData: quizData.map(function(q) { return { id: q.id, originalIndex: q.originalIndex, question: q.question, answerKey: q.answerKey, options: q.options, type: q.type, analysis: q.analysis, shuffledOptions: q.shuffledOptions }; }),
                timestamp: new Date().toISOString()
            };
            history.unshift(newRecord);
            if (history.length > HISTORY_LIMIT) history = history.slice(0, HISTORY_LIMIT);
            localStorage.setItem(historyKey, JSON.stringify(history));
        }

        // V20.0: 删除单条历史记录 — 无弹窗静默删除 + 卡片淡出消失
        window.deleteHistoryRecord = function(quizName, quizHash, historyIndex, cardElement) {
            // 1. 先执行 LocalStorage 删除
            var historyKey = 'HISTORY_' + quizName + '_' + quizHash;
            try {
                var history = JSON.parse(localStorage.getItem(historyKey));
                if (history && history[historyIndex] !== undefined) {
                    history.splice(historyIndex, 1);
                    if (history.length === 0) {
                        localStorage.removeItem(historyKey);
                    } else {
                        localStorage.setItem(historyKey, JSON.stringify(history));
                    }
                }
            } catch (e) {
                console.error("删除历史记录失败:", e);
                showToast('删除历史记录失败', 'error');
                return;
            }

            // 2. 卡片淡出动画
            if (cardElement) {
                // 找到 .history-card 外壳（如果传入的是 button 则向上查找）
                var card = cardElement.closest ? cardElement.closest('.history-card') : cardElement;
                if (card) {
                    card.classList.add('fading');
                    card.addEventListener('animationend', function handler() {
                        card.removeEventListener('animationend', handler);
                        if (card.parentNode) card.parentNode.removeChild(card);
                        // 检查该题库是否还有剩余历史卡片，若无可折叠该 Accordion
                        var accordionBody = card.closest('.stats-accordion-body');
                        if (accordionBody && accordionBody.querySelectorAll('.history-card').length === 0) {
                            var accordion = accordionBody.closest('.stats-accordion');
                            if (accordion && accordion.parentNode) {
                                accordion.parentNode.removeChild(accordion);
                            }
                        }
                        // 重新计算全局统计
                        refreshGlobalStats();
                    });
                    return;
                }
            }

            // 兜底：若无卡片引用，整页刷新
            renderStatsPage();
        };

        // V20.0: 回顾历史（只回顾错题）
        window.reviewHistoricalQuiz = function(quizName, quizHash, historyIndex) {
            clearAutoAdvanceTimer();

            var historyKey = 'HISTORY_' + quizName + '_' + quizHash;
            try {
                var history = JSON.parse(localStorage.getItem(historyKey));
                if (history && history[historyIndex]) {
                    var record = history[historyIndex];

                    currentQuizName = quizName;
                    currentQuizHash = quizHash;

                    // V20.0: 只筛选错题进入回顾
                    var wrongQuizData = [];
                    var wrongUserAnswers = [];
                    record.quizData.forEach(function(q, idx) {
                        if (!checkAnswer(q, record.userAnswers[idx])) {
                            wrongQuizData.push(q);
                            wrongUserAnswers.push(record.userAnswers[idx]);
                        }
                    });

                    if (wrongQuizData.length === 0) {
                        alert("该次考试全部答对，没有错题可供回顾！");
                        return;
                    }

                    quizData = wrongQuizData;
                    userAnswers = wrongUserAnswers;
                    seconds = record.seconds;
                    isExamFinished = true;
                    currentQuestionIndex = 0;

                    setAppState('Review');
                    alert('已加载 ' + quizName + ' 的历史回顾，共 ' + quizData.length + ' 道错题，总用时：' + new Date(seconds * 1000).toISOString().substr(11, 8));
                }
            } catch (e) {
                alert("加载历史记录失败。");
            }
        };

        window.startReviewWrongQuiz = function(quizName, quizHash, historyIndex) {
            clearAutoAdvanceTimer();

            var historyKey = 'HISTORY_' + quizName + '_' + quizHash;
            try {
                var history = JSON.parse(localStorage.getItem(historyKey));
                if (history && history[historyIndex]) {
                    var record = history[historyIndex];

                    var wrongQuestions = [];
                    record.quizData.forEach(function(q, qIndex) {
                        if (!checkAnswer(q, record.userAnswers[qIndex])) {
                            wrongQuestions.push(q);
                        }
                    });

                    if (wrongQuestions.length === 0) {
                        alert("本次考试中没有做错的题目，无需重做！");
                        return;
                    }

                    currentQuizName = quizName;
                    currentQuizHash = quizHash;

                    if (isShuffleQuestions) {
                        quizData = shuffleArray(wrongQuestions);
                    } else {
                        quizData = wrongQuestions;
                    }
                    localStorage.removeItem('PROGRESS_' + currentQuizName + '_' + currentQuizHash);

                    userAnswers = new Array(quizData.length).fill(null).map(function(_, index) {
                        var qType = quizData[index].type;
                        return qType && qType.indexOf('多选') !== -1 ? [] : null;
                    });
                    seconds = 0;
                    currentQuestionIndex = 0;
                    isExamFinished = false;

                    if (isShuffleOptions) {
                        quizData = initializeQuestionOptions(quizData);
                    } else {
                        quizData.forEach(function(q) {
                            if (!q.shuffledOptions) {
                                q.shuffledOptions = q.options.slice();
                            }
                        });
                    }

                    setAppState('Quiz');

                    alert('已从 ' + quizName + ' 中筛选出 ' + quizData.length + ' 道错题，开始重做！');
                }
            } catch (e) {
                alert("加载错题重做数据失败。");
            }
        };

        window.deleteQuiz = function(quizName, quizHash) {
            if (!confirm('警告：确定要删除题库「' + quizName + '」及其所有历史记录和进度吗？此操作不可逆！')) {
                return;
            }

            localStorage.removeItem('PROGRESS_' + quizName + '_' + quizHash);
            localStorage.removeItem('HISTORY_' + quizName + '_' + quizHash);

            var quizList = getQuizList();
            var targetQuiz = quizList.find(function(q) { return q.name === quizName && q.hash === quizHash; });
            if (targetQuiz) {
                localStorage.removeItem(targetQuiz.dataKey);
            }

            quizList = quizList.filter(function(q) { return !(q.name === quizName && q.hash === quizHash); });
            localStorage.setItem(QUIZ_LIST_KEY, JSON.stringify(quizList));

            if (currentQuizName === quizName && currentQuizHash === quizHash) {
                currentQuizName = null;
                currentQuizHash = null;
                quizData = [];
                userAnswers = [];
            }

            alert('题库「' + quizName + '」已删除。');
            renderHomePage();
        };

        // =========================================================
        // D. 题库文本解析
        // =========================================================
        function parseQuizText(rawText) {
            var parsedData = [];
            var lines = rawText.split(/\r?\n/).map(function(l) { return l.trim(); }).filter(function(l) { return l.length > 0; });

            var cur = null, curAnalysis = '', pending = '', lastLabel = null;
            var questionRegex = /^(\d+)\s*([.、)\]])\s*(?:\(([单多]选题)[,，]\s*[\d.]+\s*分\))?\s*(.*)$/;
            var optionRegex = /^([A-Z])\s*([.、)\]])\s*(.*)$/;
            var answerRegex = /(?:正确答案|【答案】|答案|KEY|Answer)[：:]\s*([A-Z]+)/i;
            var analysisRegex = /^(?:解析|分析|Analysis)[：:]\s*(.*)$/i;
            var sectionRegex = /^[一二三四五六七八九十]+[.、]\s*(?:单选题|多选题|判断题)/;
            var isAnalysis = false, detType = "单选题";

            function _flush() {
                if (lastLabel && pending) { cur.options.push({ label: lastLabel + '.', text: pending.trim() }); pending = ''; lastLabel = null; }
            }
            function _finish() {
                _flush();
                if (cur && cur.options.length > 0 && cur.answerKey) { cur.analysis = curAnalysis.trim(); parsedData.push(cur); }
            }

            for (var i = 0; i < lines.length; i++) {
                var line = lines[i];

                if (sectionRegex.test(line)) { detType = line.indexOf('多选') !== -1 ? "多选题" : "单选题"; continue; }

                var am = line.match(answerRegex);
                if (am && cur) { _flush(); cur.answerKey = am[1].toUpperCase(); if (cur.answerKey.length > 1) cur.type = "多选题"; isAnalysis = false; continue; }

                var qm = line.match(questionRegex);
                if (qm) {
                    _finish();
                    var qt = detType;
                    if (qm[3]) qt = qm[3].indexOf('多') !== -1 ? "多选题" : "单选题";
                    cur = { id: parsedData.length + 1, originalIndex: parsedData.length, type: qt, question: (qm[4]||'').trim(), options: [], answerKey: null, analysis: '', shuffledOptions: null };
                    pending = ''; lastLabel = null; curAnalysis = ''; isAnalysis = false;
                    continue;
                }
                if (!cur) continue;

                var om = line.match(optionRegex);
                if (om && !isAnalysis) { _flush(); lastLabel = om[1]; pending = om[3] ? om[3].trim() : ''; continue; }

                var xm = line.match(analysisRegex);
                if (xm) { _flush(); isAnalysis = true; curAnalysis = (xm[1]||'').trim() + ' '; continue; }

                if (isAnalysis) { curAnalysis += line + ' '; }
                else if (lastLabel !== null) { pending += (pending ? ' ' : '') + line; }
                else if (cur && cur.options.length === 0) { cur.question += (cur.question ? ' ' : '') + line; }
            }

            _finish();

            // 校验 + toast
            var rawCount = parsedData.length;
            parsedData = parsedData.filter(function(q) {
                if (q.options.length < 2) return false;
                if (!q.answerKey || q.answerKey.length === 0) return false;
                var validLabels = q.options.map(function(o) { return o.label[0]; });
                var keys = q.answerKey.split('');
                for (var ki = 0; ki < keys.length; ki++) {
                    if (validLabels.indexOf(keys[ki]) === -1) return false;
                }
                return true;
            });
            if (rawCount > 0 && parsedData.length === 0) {
                showToast('解析到 ' + rawCount + ' 条疑似题目但全部校验失败，请检查文件格式', 'warn');
            } else if (rawCount > parsedData.length) {
                showToast('已跳过 ' + (rawCount - parsedData.length) + ' 道格式不符的题目（缺少选项/答案不匹配）', 'warn');
            }

            return parsedData;
        }

        // =========================================================
        // E. UI 渲染与流程控制
        // =========================================================

        function renderHomePage() {
            var quizList = getQuizList();
            var container = document.getElementById('quiz-list-container');
            var triggerBtn = document.getElementById('quiz-picker-trigger-btn');
            var triggerText = document.getElementById('quiz-picker-trigger-text');
            container.innerHTML = '';

            if (quizList.length === 0) {
                container.innerHTML = '<div style="text-align:center;padding:30px 0;">\
                    <span class="material-icons" style="font-size:48px;color:#CCC;display:block;margin-bottom:12px;">menu_book</span>\
                    <p style="color:var(--color-text-secondary);margin:0;">暂无题库，点击下方导入</p>\
                </div>';
                if (triggerBtn) triggerBtn.style.display = 'none';
                return;
            }

            if (isCurrentCardHidden) {
                container.innerHTML = '<p style="color:var(--color-text-secondary);text-align:center;padding:16px 0;margin:0;font-size:0.9em;font-style:italic;">题库隐藏</p>';
                if (triggerText) triggerText.textContent = '选择题库';
                if (triggerBtn) triggerBtn.style.display = 'flex';
                return;
            }

            if (triggerBtn) {
                triggerBtn.style.display = quizList.length > 1 ? 'flex' : 'none';
            }
            if (triggerText) triggerText.textContent = '切换题库';

            var quiz = quizList[0];
            var safeName = escapeHtml(quiz.name);
            var safeNameJs = escapeJsStr(quiz.name);
            var safeHashJs = escapeJsStr(quiz.hash);

            var pk = 'PROGRESS_' + quiz.name + '_' + quiz.hash;
            var bestTotal = quiz.questionCount, bestAns = 0, bestKey = null;
            try { var nd = JSON.parse(localStorage.getItem(pk)); if (nd) { bestTotal = nd.userAnswers ? nd.userAnswers.length : quiz.questionCount; bestAns = nd.userAnswers ? nd.userAnswers.filter(function(a){return hasAnswered(a);}).length : 0; bestKey = pk; } } catch(e) {}
            var startBtnText = '开始答题', startOnclick = 'startQuiz(\'' + safeNameJs + '\')';
            if (bestKey) { startBtnText = '继续答题'; }

            var splitBtn = quiz.questionCount > 50 ? '<button style="padding:12px 16px;font-size:0.95em;font-weight:600;border:none;border-radius:10px;background:#F5F5F7;color:var(--color-primary);cursor:pointer;flex-shrink:0;transition:all 0.2s;" onclick="showSplitModal(\'' + safeNameJs + '\',\'' + safeHashJs + '\',' + quiz.questionCount + ')">拆分</button>' : '';

            var quizCard = document.createElement('div');
            quizCard.style.cssText = 'margin-bottom:0;box-shadow:none;padding:8px 0;';
            quizCard.innerHTML = '\
                <h4 style="margin-bottom:6px;"><span style="font-weight:700;font-size:1.1em;">' + safeName + '</span></h4>\
                <p style="margin:0 0 12px 0;color:var(--color-text-secondary);font-size:0.9em;">总题数: ' + quiz.questionCount + '</p>\
                <div style="display:flex;gap:8px;align-items:stretch;">\
                    <button style="padding:12px 15px;font-size:0.95em;font-weight:bold;border:none;border-radius:10px;background:var(--color-primary);color:#fff;cursor:pointer;flex-grow:1;display:inline-flex;align-items:center;justify-content:center;gap:4px;" onclick="' + startOnclick + '"><span class="material-icons" style="font-size:18px;color:#fff;">play_arrow</span>' + startBtnText + '</button>\
                    ' + splitBtn + '\
                </div>\
            ';
            container.appendChild(quizCard);
        }

        function renderStatsPage() {
            var quizList = getQuizList();
            historyListContent.innerHTML = '';
            var lastScoreDisplay = document.getElementById('last-score');
            if (lastScoreDisplay) lastScoreDisplay.textContent = '--';

            if (quizList.length === 0) {
                historyListContent.innerHTML = '<p style="color:var(--color-text-secondary);text-align:center;padding:20px 0;">请先导入题库以查看统计和历史记录。</p>';
                return;
            }

            var globalAnswered = 0, globalTotalQuestions = 0;
            quizList.forEach(function(q) {
                globalTotalQuestions += q.questionCount;
                try { var p = JSON.parse(localStorage.getItem('PROGRESS_' + q.name + '_' + q.hash)); if (p && p.userAnswers) globalAnswered += p.userAnswers.filter(hasAnswered).length; } catch(e) {}
            });

            var wrap = document.getElementById('global-stats-wrap');
            if (wrap) {
                wrap.innerHTML = '';
                wrap.style.cssText = 'display:flex;gap:12px;flex-wrap:wrap;margin-bottom:8px;';
                var items = [{v:quizList.length,l:'题库'},{v:globalTotalQuestions,l:'题目'},{v:globalAnswered,l:'已答'}];
                for(var gi=0;gi<3;gi++){ wrap.innerHTML += '<div style="flex:1 1 0;min-width:80px;background:var(--color-card-bg);border-radius:12px;padding:16px 8px;text-align:center;border:1px solid rgba(0,0,0,0.03);"><div style="font-size:1.5em;font-weight:700;color:var(--color-text-main);">'+items[gi].v+'</div><div style="font-size:0.75em;color:var(--color-text-secondary);margin-top:4px;">'+items[gi].l+'</div></div>'; }
            }

            var currentQuiz = quizList[0];
            var safeNameJs2 = escapeJsStr(currentQuiz.name);
            var safeHashJs2 = escapeJsStr(currentQuiz.hash);
            var historyKey = 'HISTORY_' + currentQuiz.name + '_' + currentQuiz.hash;
            var history = JSON.parse(localStorage.getItem(historyKey)) || [];

            if (history.length > 0 && lastScoreDisplay) {
                var firstR = history[0];
                var cCount = 0;
                firstR.quizData.forEach(function(q, i){ if(checkAnswer(q, firstR.userAnswers[i])) cCount++; });
                var sc = ((cCount / firstR.quizData.length) * 100).toFixed(1);
                lastScoreDisplay.innerHTML = sc + '分 (用时 ' + new Date(firstR.seconds * 1000).toISOString().substr(11,8) + ')';
                lastScoreDisplay.style.color = sc >= 80 ? 'var(--color-primary)' : 'var(--color-wrong)';
            }

            if (isHistoryHidden) {
                var hiddenWrap = document.createElement('div');
                hiddenWrap.style.cssText = 'text-align:center;padding:40px 20px;display:flex;flex-direction:column;align-items:center;gap:14px;';
                hiddenWrap.innerHTML = '<p style="color:var(--color-text-secondary);margin:0;font-size:0.95em;font-style:italic;">历史记录隐藏</p><button onclick="openQuizPicker()" style="padding:10px 24px;border:none;border-radius:12px;background:rgba(0,0,0,0.035);color:var(--color-text-main);font-size:0.9em;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:6px;transition:background 0.2s;"><span class="material-icons" style="font-size:18px;">visibility</span>查看历史记录</button>';
                historyListContent.appendChild(hiddenWrap);
                return;
            }

            var headerHtml = document.createElement('div');
            headerHtml.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid rgba(0,0,0,0.04);';
            headerHtml.innerHTML = '<div style="display:flex;align-items:center;gap:8px;max-width:70%;"><h3 style="margin:0;font-size:1.05em;font-weight:700;color:var(--color-text-main);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + escapeHtml(currentQuiz.name) + '</h3><button class="header-delete-btn" onclick="clearAllHistoryOfQuiz(\'' + safeNameJs2 + '\',\'' + safeHashJs2 + '\')" title="清空此题库全部历史"><span class="material-icons" style="font-size:18px;">delete</span></button></div><button onclick="openQuizPicker()" style="background:rgba(0,0,0,0.035);border:none;padding:6px 14px;border-radius:12px;color:var(--color-text-main);font-weight:600;font-size:0.9em;cursor:pointer;display:flex;align-items:center;gap:4px;transition:background 0.2s;"><span class="material-icons" style="font-size:16px;">swap_vert</span>切换</button>';
            historyListContent.appendChild(headerHtml);

            if (history.length === 0) {
                var empty = document.createElement('p');
                empty.style.cssText = 'color:var(--color-text-secondary);text-align:center;padding:20px 0;margin:0;';
                empty.textContent = '该题库暂无历史记录。';
                historyListContent.appendChild(empty);
                return;
            }

            history.forEach(function(record, hIdx) {
                var total = record.quizData.length;
                var correctCount = 0;
                record.quizData.forEach(function(q, qIdx) { if (checkAnswer(q, record.userAnswers[qIdx])) correctCount++; });
                var wrongCount = total - correctCount;
                var score = ((correctCount / total) * 100).toFixed(1);
                var timeStr = new Date(record.seconds * 1000).toISOString().substr(11, 8);
                var dateStr = new Date(record.timestamp).toLocaleString();
                var splitTag = record.splitLabel ? '<span style="background:var(--color-background);border:1px solid var(--color-primary);color:var(--color-primary);padding:2px 6px;border-radius:6px;font-size:0.75em;margin-right:6px;font-weight:600;">拆分 ' + record.splitLabel + '</span>' : '';

                var historyCard = document.createElement('div');
                historyCard.className = 'history-card';
                historyCard.style.cssText = 'border-left:none;background:#FFFFFF;border:1px solid rgba(0,0,0,0.04);box-shadow:0 4px 16px rgba(0,0,0,0.02);margin-top:0;margin-bottom:12px;border-radius:16px;position:relative;overflow:hidden;';
                historyCard.innerHTML = '\
                    <button class="delete-history-btn" onclick="event.stopPropagation();deleteHistoryRecord(\'' + safeNameJs2 + '\',\'' + safeHashJs2 + '\',' + hIdx + ',this)" style="border:none;background:rgba(0,0,0,0.03);color:var(--color-text-secondary);"><span class="material-icons">delete</span></button>\
                    <div style="margin:0;font-size:0.9em;padding-right:30px;line-height:1.7;color:var(--color-text-main);">\
                        <div style="margin-bottom:4px;">' + splitTag + '<strong>得分: <span style="font-size:1.15em;color:' + (score >= 80 ? 'var(--color-primary)' : 'var(--color-wrong)') + ';">' + score + '分</span></strong> <span style="color:rgba(0,0,0,0.1);margin:0 6px;">|</span> 对/错: ' + correctCount + '/' + wrongCount + '</div>\
                        <div style="color:var(--color-text-secondary);font-size:0.9em;display:flex;justify-content:space-between;align-items:center;">\
                            <span>用时: ' + timeStr + '</span>\
                            <span style="font-size:0.85em;color:#A0A0A5;">' + dateStr + '</span>\
                        </div>\
                    </div>\
                    <div style="display:flex;gap:10px;margin-top:14px;">\
                        <button onclick="reviewHistoricalQuiz(\'' + safeNameJs2 + '\',\'' + safeHashJs2 + '\',' + hIdx + ')" style="flex:1;padding:10px 0;border:none;border-radius:10px;background:#F5F5F7;color:var(--color-primary);font-size:0.9em;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:4px;transition:opacity 0.2s;"><span class="material-icons" style="font-size:18px;">manage_search</span> 回顾错题</button>\
                        <button onclick="startReviewWrongQuiz(\'' + safeNameJs2 + '\',\'' + safeHashJs2 + '\',' + hIdx + ')" style="flex:1;padding:10px 0;border:none;border-radius:10px;background:#FFF5F5;color:var(--color-wrong);font-size:0.9em;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:4px;transition:opacity 0.2s;"' + (wrongCount === 0 ? ' disabled style="opacity:0.5;cursor:not-allowed;"' : '') + '><span class="material-icons" style="font-size:18px;">replay</span> 重做 (' + wrongCount + ')</button>\
                    </div>\
                ';
                historyListContent.appendChild(historyCard);
            });
        }

        // V20.0: 静默刷新全局统计数据（不重绘整个页面）
        function refreshGlobalStats() {
            if (appState !== 'Stats') return;
            var quizList = getQuizList();
            var globalAnswered = 0;
            var globalTotalQuestions = 0;
            quizList.forEach(function(quiz) {
                globalTotalQuestions += quiz.questionCount;
                var activeKey = 'PROGRESS_' + quiz.name + '_' + quiz.hash;
                var savedData = localStorage.getItem(activeKey);
                if (savedData) {
                    try {
                        var data = JSON.parse(savedData);
                        if (data.userAnswers && Array.isArray(data.userAnswers)) {
                            globalAnswered += data.userAnswers.filter(function(a) { return hasAnswered(a); }).length;
                        }
                    } catch(e) {}
                }
            });
            var gsR = document.getElementById('global-stats-wrap');
            if (gsR) {
                gsR.innerHTML = '';
                gsR.style.cssText = 'display:flex;gap:12px;flex-wrap:wrap;margin-bottom:8px;';
                var itms = [{v:quizList.length,l:'题库'},{v:globalTotalQuestions,l:'题目'},{v:globalAnswered,l:'已答'}];
                for(var gi=0;gi<3;gi++){ gsR.innerHTML += '<div style=\"flex:1 1 0;min-width:80px;background:var(--color-card-bg);border-radius:8px;padding:12px 8px;text-align:center;border:1px solid var(--color-border-light);\"><div style=\"font-size:1.4em;font-weight:700;color:var(--color-primary);\">'+itms[gi].v+'</div><div style=\"font-size:0.75em;color:var(--color-text-secondary);\">'+itms[gi].l+'</div></div>'; }
            }

            // 更新上次得分（取第一条记录）
            var hasHistory = false;
            for (var i = 0; i < quizList.length; i++) {
                var key = 'HISTORY_' + quizList[i].name + '_' + quizList[i].hash;
                var hist = JSON.parse(localStorage.getItem(key));
                if (hist && hist.length > 0) {
                    var r = hist[0];
                    var total = r.quizData.length;
                    var correct = 0;
                    r.quizData.forEach(function(q, idx) { if (checkAnswer(q, r.userAnswers[idx])) correct++; });
                    var sc = ((correct / total) * 100).toFixed(1);
                    var ts = new Date(r.seconds * 1000).toISOString().substr(11, 8);
                    if (lastScoreDisplay) {
                        lastScoreDisplay.innerHTML = sc + '分 (用时 ' + ts + ')';
                        lastScoreDisplay.style.color = sc >= 80 ? 'var(--color-primary)' : 'var(--color-wrong)';
                    }
                    hasHistory = true;
                    break;
                }
            }
            if (!hasHistory && lastScoreDisplay) {
                lastScoreDisplay.textContent = '--';
                lastScoreDisplay.style.color = 'var(--color-primary)';
            }
        }

        function initQuizUI() {
            if (quizData.length === 0) {
                setAppState('Home');
                return;
            }

            resultSummaryDiv.style.display = 'none';

            if (isExamFinished) {
                stopTimer();
                var c = 0; quizData.forEach(function(q, i) { if (checkAnswer(q, userAnswers[i])) c++; });
                displayResultSummaryWithData(quizData.length, c);
            } else {
                startTimer();
            }

            initAnswerCard();
            // V20.0: 保持当前题号不变（静默恢复时不会跳回第1题）
            if (currentQuestionIndex >= quizData.length) {
                currentQuestionIndex = 0;
            }
            renderQuestion(currentQuestionIndex);
        }

        function handleSubmit() {
            if (isExamFinished) return;

            stopTimer();
            clearAutoAdvanceTimer();
            isExamFinished = true;
            submitBtn.style.display = 'none';

            var totalQuestions = quizData.length;
            var correctTally = 0;

            quizData.forEach(function(q, index) {
                updateCardStatus(index + 1, userAnswers[index]);
                if (checkAnswer(q, userAnswers[index])) correctTally++;
            });

            var displayContainer = questionDisplayArea.querySelector('#current-question-display');
            if (displayContainer) displayContainer.remove();

            saveHistory(userAnswers, seconds);
            localStorage.removeItem('PROGRESS_' + currentQuizName + '_' + currentQuizHash);

            displayResultSummaryWithData(totalQuestions, correctTally);

            var wrongData = [];
            var wrongAnswers = [];
            quizData.forEach(function(q, idx) {
                if (!checkAnswer(q, userAnswers[idx])) {
                    wrongData.push(q);
                    wrongAnswers.push(userAnswers[idx]);
                }
            });
            quizData = wrongData;
            userAnswers = wrongAnswers;

            setAppState('Review');

            if (quizData.length > 0) {
                currentQuestionIndex = 0;
                renderQuestion(0);
            }

            if (window.innerWidth <= 768) toggleAnswerCard(false);
        }

        function displayResultSummaryWithData(total, correctCount) {
            var wrongCount = total - correctCount;
            var score = ((correctCount / total) * 100).toFixed(1);
            var timeStr = new Date(seconds * 1000).toISOString().substr(11, 8);

            var safeQuizName = escapeHtml(currentQuizName || '未知');
            var summaryHtml = '\
                <h2>考试结果 🎉</h2>\
                <p>题库：<strong style="color: var(--color-secondary);">' + safeQuizName + '</strong></p>\
                <p>总用时：<strong style="color: var(--color-text-main);">' + timeStr + '</strong></p>\
                <p>总题数：<strong>' + total + '</strong></p>\
                <p><strong>最终得分：<span style="font-size: 1.5em; color: ' + (score >= 80 ? 'var(--color-primary)' : 'var(--color-wrong)') + ';">' + score + '分</span></strong></p>\
                <p>答对题数：<strong style="color: var(--color-correct);">' + correctCount + '</strong></p>\
                <p>答错题数：<strong style="color: var(--color-wrong);">' + wrongCount + '</strong></p>\
            ';

            resultSummaryDiv.innerHTML = summaryHtml;
            resultSummaryDiv.style.display = 'block';
        }

        // =========================================================
        // V15.0: 自动跳转定时器管理
        // =========================================================

        function clearAutoAdvanceTimer() {
            if (autoAdvanceTimer) {
                clearTimeout(autoAdvanceTimer);
                autoAdvanceTimer = null;
            }
        }

        function scheduleAutoAdvance() {
            clearAutoAdvanceTimer();
            if (!isMemorizeMode || !isAutoAdvance || isExamFinished) return;
            if (currentQuestionIndex >= quizData.length - 1) return;

            var delay = 500 + Math.floor(Math.random() * 300);
            autoAdvanceTimer = setTimeout(function() {
                if (_wrongQueue && _wrongQueue.length > 0) { goToNextQuestion(); }
                else if (!_wrongQueue && currentQuestionIndex < quizData.length - 1) { goToNextQuestion(); }
            }, delay);
        }

        // =========================================================
        // 核心：渲染题目 (V15.0 - 集成滑动切题)
        // =========================================================

        function renderQuestion(index) {
            clearAutoAdvanceTimer();
            window.scrollTo(0, 0);

            if (_wrongQueue && _wrongQueue.length > 0) { index = _wrongQueue[0]; }
            else if (_wrongQueue && _wrongQueue.length === 0 && !isExamFinished) { handleSubmit(); return; }

            currentQuestionIndex = index;
            var questionData = quizData[index];
            if (!questionData) return;
            // 防御：校验题目数据完整性
            if (!questionData.question || !questionData.options || questionData.options.length < 2) {
                showToast('第' + (index + 1) + '题数据异常，已跳过', 'warn');
                if (index < quizData.length - 1) { renderQuestion(index + 1); }
                return;
            }

            resultSummaryDiv.style.display = 'none';

            var oldContainer = questionDisplayArea.querySelector('#current-question-display');
            if (oldContainer) oldContainer.remove();

            var displayContainer = document.createElement('div');
            displayContainer.id = 'current-question-display';

            var container = document.createElement('div');
            container.className = 'question-container';

            var title = document.createElement('div');
            title.className = 'question-title';
            var typeHint = questionData.type.indexOf('多选') !== -1 ? ' <span class="multi-hint">可多选</span>' : '';
            title.innerHTML = (index + 1) + '. [' + escapeHtml(questionData.type) + ']' + typeHint + ' ' + escapeHtml(questionData.question);
            container.appendChild(title);

            var optionsToRender = questionData.shuffledOptions || questionData.options;

            optionsToRender.forEach(function(option) {
                var optionDiv = document.createElement('div');
                optionDiv.className = 'option-item';
                optionDiv.textContent = option.label + ' ' + option.text;

                var optionLetter = option.label[0];
                optionDiv.dataset.optionValue = optionLetter;

                var userAnswer = userAnswers[index];

                var isSelected = questionData.type.indexOf('多选') !== -1
                    ? userAnswer && Array.isArray(userAnswer) && userAnswer.indexOf(optionLetter) !== -1
                    : userAnswer === optionLetter;

                if (isSelected) {
                    optionDiv.classList.add('selected');
                }

                // 背题模式 - 在渲染时就直接应用高亮并锁定
                if (isMemorizeMode && !isExamFinished && hasAnswered(userAnswer)) {
                    var isCorrectOption = questionData.answerKey.indexOf(optionLetter) !== -1;
                    if (isCorrectOption) {
                        optionDiv.classList.add('memorize-correct');
                    }
                    if (isSelected && !isCorrectOption) {
                        optionDiv.classList.add('memorize-wrong');
                    }
                    optionDiv.classList.add('memorize-disabled');
                }

                if (isExamFinished) {
                    var isCorrectOptionReview = questionData.answerKey.indexOf(optionLetter) !== -1;
                    if (isCorrectOptionReview) {
                        optionDiv.classList.add('correct-answer-bg');
                    }
                    if (isSelected && !isCorrectOptionReview) {
                        optionDiv.classList.add('wrong-selected-bg');
                    }
                    optionDiv.style.cursor = 'default';
                } else {
                    optionDiv.addEventListener('click', function(e) {
                        var selectedLetter = e.currentTarget.dataset.optionValue;
                        handleOptionClick(index, selectedLetter, e.currentTarget);
                        saveActiveProgress();
                    });
                }

                container.appendChild(optionDiv);
            });

            // 背题模式 - 若已作答，渲染时自动显示反馈
            if (isMemorizeMode && !isExamFinished) {
                var userAns = userAnswers[index];
                if (hasAnswered(userAns)) {
                    applyMemorizeFeedback(index);
                }
            }

            if (isExamFinished && questionData.analysis) {
                var analysisDiv = document.createElement('div');
                analysisDiv.className = 'review-analysis';
                analysisDiv.innerHTML = '<br><strong>【解析】</strong> ' + escapeHtml(questionData.analysis);
                container.appendChild(analysisDiv);
            }

            displayContainer.appendChild(container);

            questionDisplayArea.innerHTML = '';
            questionDisplayArea.appendChild(displayContainer);

            updateCardStatus(index + 1, userAnswers[index]);
            updateCardToggleText();

            attachSwipeListeners(displayContainer);
        }

        // V20.1: 竞态锁 — 同一题背题判定期间拦截所有并发点击
        var _memorizeLockIndex = -1;
        function handleOptionClick(qIndex, selectedLabel, clickedDiv) {
            clearAutoAdvanceTimer();

            var questionData = quizData[qIndex];

            // 背题模式下：已作答 或 正在判定中 均拦截后续点击
            if (isMemorizeMode && !isExamFinished) {
                if (hasAnswered(userAnswers[qIndex]) || _memorizeLockIndex === qIndex) {
                    return;
                }
            }

            if (questionData.type.indexOf('多选') !== -1) {
                if (Array.isArray(userAnswers[qIndex]) && userAnswers[qIndex].indexOf(selectedLabel) !== -1) {
                    userAnswers[qIndex] = userAnswers[qIndex].filter(function(l) { return l !== selectedLabel; });
                    clickedDiv.classList.remove('selected');
                } else {
                    if (!Array.isArray(userAnswers[qIndex])) userAnswers[qIndex] = [];
                    userAnswers[qIndex].push(selectedLabel);
                    clickedDiv.classList.add('selected');
                }
            } else {
                var optionItems = clickedDiv.parentNode.querySelectorAll('.option-item');
                optionItems.forEach(function(item) { item.classList.remove('selected'); });
                userAnswers[qIndex] = selectedLabel;
                clickedDiv.classList.add('selected');
            }

            // 背题模式 - 即时判定（加竞态锁）
            if (isMemorizeMode && !isExamFinished) {
                _memorizeLockIndex = qIndex;
                try {
                    applyMemorizeFeedback(qIndex);

                    // V15.0: 答对自动跳转
                    var isCorrect = checkAnswer(questionData, userAnswers[qIndex]);
                    if (isCorrect && isAutoAdvance) {
                        scheduleAutoAdvance();
                    }

                    // 锁定所有选项，禁止二次点击
                    var optionItems = clickedDiv.parentNode.querySelectorAll('.option-item');
                    for (var oi = 0; oi < optionItems.length; oi++) {
                        optionItems[oi].classList.add('memorize-disabled');
                    }
                } finally {
                    _memorizeLockIndex = -1;
                }

                if (isWrongReinsert && _wrongQueue && _wrongQueue.length > 0) {
                    var isRight = checkAnswer(questionData, userAnswers[qIndex]);
                    if (isRight) {
                        _wrongQueue.shift();
                    } else {
                        var cur = _wrongQueue.shift();
                        var pos = _wrongQueue.length > 0 ? Math.floor(Math.random() * (_wrongQueue.length + 1)) : 0;
                        _wrongQueue.splice(pos, 0, cur);
                        if (quizData[cur]) {
                            userAnswers[cur] = quizData[cur].type.indexOf('多选') !== -1 ? [] : null;
                        }
                        var lockedOpts = clickedDiv.parentNode.querySelectorAll('.memorize-disabled');
                        for (var li = 0; li < lockedOpts.length; li++) lockedOpts[li].classList.remove('memorize-disabled');
                    }
                }
            }

            updateCardStatus(qIndex + 1, userAnswers[qIndex]);
            updateCardToggleText();
            saveActiveProgress();
        }

        // =========================================================
        // V15.0: 滑动切题（触摸 + 鼠标拖拽）
        // =========================================================
        var swipeStartX = 0;
        var swipeStartY = 0;
        var swipeActive = false;
        var swipeMinDistance = (window.innerWidth <= 768) ? 30 : 50;

        function attachSwipeListeners(container) {
            container.addEventListener('touchstart', function(e) {
                if (e.touches.length === 1) {
                    swipeStartX = e.touches[0].clientX;
                    swipeStartY = e.touches[0].clientY;
                    swipeActive = true;
                }
            }, { passive: true });

            container.addEventListener('touchend', function(e) {
                if (!swipeActive) return;
                swipeActive = false;
                var deltaX = (e.changedTouches[0].clientX - swipeStartX);
                var deltaY = (e.changedTouches[0].clientY - swipeStartY);
                handleSwipe(deltaX, deltaY);
            });

            container.addEventListener('mousedown', function(e) {
                if (e.target.closest('button') || e.target.closest('.option-item')) return;
                swipeStartX = e.clientX;
                swipeStartY = e.clientY;
                swipeActive = true;
                e.preventDefault();
            });

            container.addEventListener('mouseup', function(e) {
                if (!swipeActive) return;
                swipeActive = false;
                var deltaX = (e.clientX - swipeStartX);
                var deltaY = (e.clientY - swipeStartY);
                handleSwipe(deltaX, deltaY);
            });

            container.addEventListener('mouseleave', function() {
                swipeActive = false;
            });
        }

        function handleSwipe(deltaX, deltaY) {
            if (Math.abs(deltaX) > Math.abs(deltaY) * 1.5 && Math.abs(deltaX) > swipeMinDistance) {
                if (deltaX < 0) {
                    if (currentQuestionIndex < quizData.length - 1) {
                        clearAutoAdvanceTimer();
                        renderQuestion(currentQuestionIndex + 1);
                    }
                } else if (deltaX > 0) {
                    if (currentQuestionIndex > 0) {
                        clearAutoAdvanceTimer();
                        renderQuestion(currentQuestionIndex - 1);
                    }
                }
            }
        }

        // =========================================================
        // 背题模式即时反馈
        // =========================================================

        // V21.0: 背题模式下仅高亮选项红绿色，不显示文字反馈
        function applyMemorizeFeedback(qIndex) {
            var questionData = quizData[qIndex];
            var userAnswer = userAnswers[qIndex];
            var container = questionDisplayArea.querySelector('#current-question-display .question-container');
            if (!container) return;
            if (!hasAnswered(userAnswer)) return;

            var allOptions = container.querySelectorAll('.option-item');
            allOptions.forEach(function(opt) {
                opt.classList.remove('memorize-correct', 'memorize-wrong');
                var letter = opt.dataset.optionValue;
                var isCorrectOption = questionData.answerKey.indexOf(letter) !== -1;
                var isSelected = questionData.type.indexOf('多选') !== -1
                    ? Array.isArray(userAnswer) && userAnswer.indexOf(letter) !== -1
                    : userAnswer === letter;
                if (isCorrectOption) opt.classList.add('memorize-correct');
                if (isSelected && !isCorrectOption) opt.classList.add('memorize-wrong');
            });
        }

        function initAnswerCard() {
            cardGrid.innerHTML = '';
            quizData.forEach(function(question, index) {
                var cardItem = document.createElement('div');
                cardItem.dataset.content = index + 1;
                cardItem.className = 'card-item status-default';
                cardItem.id = 'card-item-' + (index + 1);

                cardItem.addEventListener('click', function() {
                    clearAutoAdvanceTimer();
                    renderQuestion(index);
                    if (window.innerWidth <= 768 && isCardVisible) {
                        toggleAnswerCard();
                    }
                });

                cardGrid.appendChild(cardItem);
            });
            quizData.forEach(function(_, index) {
                updateCardStatus(index + 1, userAnswers[index]);
            });
        }

        function updateCardStatus(questionNumber, userAnswer) {
            var cardItem = document.getElementById('card-item-' + questionNumber);
            if (!cardItem) return;

            cardItem.classList.remove('status-default', 'status-answered', 'status-correct', 'status-wrong');

            var questionData = quizData[questionNumber - 1];
            if (!questionData) return;

            // V21.0: 背题模式即时显示对错颜色
            if (isMemorizeMode && hasAnswered(userAnswer)) {
                var isRight = checkAnswer(questionData, userAnswer);
                cardItem.classList.add(isRight ? 'status-correct' : 'status-wrong');
            } else if (isExamFinished) {
                var isCorrect = checkAnswer(questionData, userAnswer);
                cardItem.classList.add(isCorrect ? 'status-correct' : 'status-wrong');
            } else {
                var ans = hasAnswered(userAnswer);
                cardItem.classList.add(ans ? 'status-answered' : 'status-default');
            }
        }

        window.goToPreviousQuestion = function() {
            clearAutoAdvanceTimer();
            if (currentQuestionIndex > 0) {
                renderQuestion(currentQuestionIndex - 1);
            }
        };

        window.goToNextQuestion = function() {
            clearAutoAdvanceTimer();
            if (_wrongQueue && _wrongQueue.length > 0) { renderQuestion(_wrongQueue[0]); }
            else if (!_wrongQueue && currentQuestionIndex < quizData.length - 1) { renderQuestion(currentQuestionIndex + 1); }
        };

        window.toggleAnswerCard = function(forceState) {
            var isMobile = window.innerWidth <= 768;

            if (forceState !== undefined) {
                isCardVisible = forceState;
            } else {
                isCardVisible = !isCardVisible;
            }

            if (isMobile) {
                if (isCardVisible) {
                    answerCardArea.classList.add('visible');
                } else {
                    answerCardArea.classList.remove('visible');
                }
            } else {
                answerCardArea.classList.add('visible');
                isCardVisible = true;
            }

            updateCardToggleText();
        };

        function updateCardToggleText() {
            if (quizData.length === 0) {
                cardToggleButton.textContent = '答题卡 (0/0)';
                return;
            }

            var answeredCount = userAnswers.filter(function(answer) {
                return hasAnswered(answer);
            }).length;
            var total = quizData.length;

            var text = isCardVisible ? '收起答题卡' : '答题卡';
            text += ' (' + answeredCount + '/' + total + ')';

            cardToggleButton.textContent = text;
        }

        document.addEventListener('DOMContentLoaded', function() {
            // V20.0: 加载持久化设置并同步UI
            loadSettings();
            applySettingsToUI();

            var isMobile = window.innerWidth <= 768;
            if (!isMobile) {
                bottomNav.style.display = 'none';
                answerCardArea.style.position = 'sticky';
                answerCardArea.style.top = '30px';
                answerCardArea.classList.add('visible');
                isCardVisible = true;
            } else {
                answerCardArea.style.position = 'fixed';
                answerCardArea.classList.remove('visible');
                isCardVisible = false;
            }

            // V17.0: 设置抽屉初始关闭状态
            isDrawerOpen = false;
            settingsDrawer.classList.remove('visible');
            drawerOverlay.classList.remove('visible');
            document.body.style.overflow = '';

            // V26.0: 安全处理旧版折叠逻辑，防止 null 报错阻断脚本执行
            isQuizListCollapsed = false;
            if (quizListScrollWrapper) quizListScrollWrapper.classList.remove('collapsed');
            if (quizListCollapseText) quizListCollapseText.textContent = '收起';

            // V20.1: localStorage 可用性检测
            try {
                var testKey = '_reasonix_storage_test_';
                localStorage.setItem(testKey, '1');
                localStorage.removeItem(testKey);
            } catch (e) {
                showToast('⚠️ 浏览器本地存储不可用（可能处于隐私模式），题库和进度将无法保存', 'error');
            }

            setAppState('Home');
        });

        function startTimer() {
            if (timerInterval) clearInterval(timerInterval);
            timerInterval = setInterval(function() {
                seconds++;
                timeDisplay.textContent = new Date(seconds * 1000).toISOString().substr(11, 8);
                saveActiveProgress();
            }, 1000);
        }

        function stopTimer() {
            if (timerInterval) {
                clearInterval(timerInterval);
                timerInterval = null;
            }
        }

        // =========================================================
        // F. 文件上传与多格式解析 (V11.0)
        // =========================================================

        async function readTextFileWithEncoding(file) {
            try {
                var text = await readFileAsText(file, 'UTF-8');
                if (!text.includes('') && !hasGarbledText(text)) {
                    return text;
                }
            } catch (e) {
                console.log('UTF-8 读取失败，尝试其他编码');
            }

            try {
                var text = await readFileAsText(file, 'GBK');
                return text;
            } catch (e) {
                console.log('GBK 读取失败，尝试 GB18030');
            }

            try {
                var text = await readFileAsText(file, 'GB18030');
                return text;
            } catch (e) {
                console.log('GB18030 读取失败');
            }

            try {
                var text = await readFileAsText(file, 'ISO-8859-1');
                return text;
            } catch (e) {
                throw new Error('无法识别文件编码');
            }
        }

        function readFileAsText(file, encoding) {
            return new Promise(function(resolve, reject) {
                var reader = new FileReader();
                reader.onload = function(e) { resolve(e.target.result); };
                reader.onerror = function(e) { reject(e); };
                reader.readAsText(file, encoding);
            });
        }

        function hasGarbledText(text) {
            var garbledPatterns = [
                /[\x00-\x08\x0B\x0C\x0E-\x1F]/,
                /锟斤拷/,
                /烫烫烫/,
                /屯屯屯/
            ];
            return garbledPatterns.some(function(pattern) { return pattern.test(text); });
        }

        async function parsePDFFile(file) {
            showLoading('正在解析 PDF 文件...');

            try {
                var arrayBuffer = await file.arrayBuffer();
                var pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

                var fullText = '';
                var numPages = pdf.numPages;

                for (var i = 1; i <= numPages; i++) {
                    loadingText.textContent = '正在解析 PDF 第 ' + i + '/' + numPages + ' 页...';
                    var page = await pdf.getPage(i);
                    var textContent = await page.getTextContent();
                    var pageText = textContent.items.map(function(item) { return item.str; }).join(' ');
                    fullText += pageText + '\n';
                }

                return fullText;
            } catch (e) {
                console.error('PDF 解析错误:', e);
                throw new Error('PDF 文件解析失败: ' + e.message);
            }
        }

        async function parseWordFile(file) {
            showLoading('正在解析 Word 文件...');

            try {
                var arrayBuffer = await file.arrayBuffer();
                var result = await mammoth.extractRawText({ arrayBuffer: arrayBuffer });
                return result.value;
            } catch (e) {
                console.error('Word 解析错误:', e);
                throw new Error('Word 文件解析失败: ' + e.message);
            }
        }

        // V20.1: 单例文件选择器，每次复用同一个 input，不再反复创建
        var _cachedFileInput = null;
        window.uploadNewFile = function() {
            if (isDrawerOpen) {
                toggleSettingsDrawer();
            }

            if (!_cachedFileInput) {
                _cachedFileInput = document.createElement('input');
                _cachedFileInput.type = 'file';
                _cachedFileInput.id = 'quiz-file-input';
                _cachedFileInput.accept = '.txt,.docx,.pdf';
                _cachedFileInput.style.display = 'none';
                document.body.appendChild(_cachedFileInput);

                _cachedFileInput.onchange = async function(event) {
                    var file = event.target.files[0];
                    if (!file) return;

                    var fileName = file.name;
                    var fileExt = fileName.split('.').pop().toLowerCase();
                    var baseName = fileName.replace(/\.(txt|docx|pdf)$/i, '');

                    try {
                        var rawText = '';

                        if (fileExt === 'txt') {
                            showLoading('正在读取文本文件...');
                            rawText = await readTextFileWithEncoding(file);
                        } else if (fileExt === 'docx') {
                            if (typeof mammoth === 'undefined') { hideLoading(); showToast('Word 解析组件未加载，请检查网络连接', 'error'); return; }
                            rawText = await parseWordFile(file);
                        } else if (fileExt === 'pdf') {
                            if (typeof pdfjsLib === 'undefined') { hideLoading(); showToast('PDF 解析组件未加载，请检查网络连接', 'error'); return; }
                            rawText = await parsePDFFile(file);
                        } else {
                            alert('不支持的文件格式，请上传 .txt、.docx 或 .pdf 文件。');
                            hideLoading();
                            return;
                        }

                        hideLoading();
                        startImportProcess(rawText, baseName);

                    } catch (e) {
                        hideLoading();
                        alert('文件读取失败: ' + e.message);
                    }

                    event.target.value = null;
                };
            }
            _cachedFileInput.click();
        };

        function startImportProcess(rawText, filename) {
            var quizName = filename || "未命名题库";

            var tempQuizData = parseQuizText(rawText);

            if (tempQuizData.length > 0) {
                saveQuizToList(quizName, rawText, tempQuizData);

                alert('成功导入 ' + tempQuizData.length + ' 道题目，已命名为「' + quizName + '」。请在首页选择开始答题。');
                setAppState('Home');
            } else {
                alert("解析题库失败，未识别到有效题目。\n\n请检查文件格式：\n1. 题号以数字开头（如 1.）\n2. 选项以大写字母开头（如 A.）\n3. 有「正确答案:X」或「答案：X」行");
                setAppState('Home');
            }
        }

        window.clearLocalStorageAndReload = function() {
            if (confirm("警告：这将清除所有已导入的题库、进度和历史记录。确定要继续吗？")) {
                localStorage.clear();
                location.reload();
            }
        };

        submitBtn.addEventListener('click', handleSubmit);
        window.addEventListener('beforeunload', function(){ saveActiveProgress(); });

        // 全局异常捕获：出错时 toast 提示而非静默崩溃
        window.onerror = function(msg, url, line) {
            showToast('出错: ' + String(msg).substring(0,60) + ' (行' + line + ')', 'error');
            return true;
        };

        // 解析器自测：用标准题库文本验证解析结果
        (function(){
            var test = '1. 中国的首都是？\nA. 上海\nB. 北京\nC. 广州\nD. 深圳\n正确答案:B\n解析：选B。\n\n一、多选题\n2. 可再生能源？\nA. 太阳能\nB. 煤炭\nC. 风能\n正确答案:AC';
            var r = parseQuizText(test);
            if (r.length !== 2) console.warn('解析器自测失败：题目数 ' + r.length + '，期望 2');
            else if (r[0].answerKey !== 'B') console.warn('解析器自测失败：第1题答案 ' + r[0].answerKey + '，期望 B');
            else if (r[0].options.length !== 4) console.warn('解析器自测失败：第1题选项数 ' + r[0].options.length);
            else if (r[1].type !== '多选题') console.warn('解析器自测失败：第2题类型 ' + r[1].type);
            else if (r[1].answerKey !== 'AC') console.warn('解析器自测失败：第2题答案 ' + r[1].answerKey);
        })();