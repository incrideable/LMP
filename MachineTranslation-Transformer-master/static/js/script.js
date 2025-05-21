document.addEventListener('DOMContentLoaded', function() {
    // ==================== DOM元素获取 ====================
    const dropArea = document.getElementById('drop-area');
    const fileInput = document.getElementById('fileInput');
    const uploadBtn = document.getElementById('upload-btn');
    const previewImage = document.getElementById('preview-image');
    const imagePreview = document.getElementById('image-preview');
    const clearImageBtn = document.getElementById('clear-image');
    const extractedText = document.getElementById('extracted-text');
    const translatedText = document.getElementById('translated-text');
    const translateBtn = document.getElementById('translate-btn');
    const copyResultBtn = document.getElementById('copy-result');
    const sourceLang = document.getElementById('source-lang');
    const targetLang = document.getElementById('target-lang');
    const keyboardSource = document.getElementById('keyboard-source');
    const keyboardSourceLang = document.getElementById('keyboard-source-lang');
    const realTimeToggle = document.getElementById('real-time-toggle');
    const ocrProgressBar = document.createElement('div'); // 添加进度条元素
    const ocrQualitySelector = document.getElementById('ocr-quality') || document.createElement('select'); // 图像质量选择器
    const rerunOcrBtn = document.getElementById('rerun-ocr') || document.createElement('button'); // 重新识别按钮

    // ==================== 全局变量 ====================
    let currentFile = null;
    let realTimeTranslation = false;
    let typingTimer;
    const doneTypingInterval = 1500; // 1.5秒后触发实时翻译
    const translationMethodTabs = new bootstrap.Tab(document.getElementById('camera-tab'));

    // ==================== 初始化设置 ====================
    // 设置翻译按钮默认行为
    translateBtn.onclick = function() {
        if (currentFile) {
            handleImageTranslation();
        } else {
            alert('请先上传图片');
        }
    };

    // ==================== 标签页切换逻辑 ====================
    document.getElementById('translationMethodTabs').addEventListener('shown.bs.tab', function(event) {
        const activeTab = event.target.id;
        
        if (activeTab === 'keyboard-tab') {
            translateBtn.innerHTML = '<i class="bi bi-translate"></i> 翻译文本';
            translateBtn.onclick = handleKeyboardTranslation;
        } else {
            translateBtn.innerHTML = '<i class="bi bi-translate"></i> 翻译图片';
            translateBtn.onclick = function() {
                if (currentFile) {
                    handleImageTranslation();
                } else {
                    alert('请先上传图片');
                }
            };
        }
    });

    // ==================== 图片上传功能 ====================
    // 拖放区域事件
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
        dropArea.addEventListener(eventName, highlight, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, unhighlight, false);
    });

    function highlight() {
        dropArea.classList.add('active');
    }

    function unhighlight() {
        dropArea.classList.remove('active');
    }

    // 处理文件拖放
    dropArea.addEventListener('drop', handleDrop, false);

    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        handleFiles(files);
    }

    // 点击上传按钮
    uploadBtn.addEventListener('click', () => {
        fileInput.click();
    });

    fileInput.addEventListener('change', function() {
        handleFiles(this.files);
    });

    // 处理上传的文件
    function handleFiles(files) {
        if (files.length === 0) return;
        
        const file = files[0];
        if (!file.type.match('image.*')) {
            alert('请上传图片文件');
            return;
        }
        
        if (file.size > 5 * 1024 * 1024) {
            alert('图片大小不能超过5MB');
            return;
        }
        
        currentFile = file;
        
        // 显示预览
        const reader = new FileReader();
        reader.onload = function(e) {
            previewImage.src = e.target.result;
            imagePreview.classList.remove('d-none');
            translateBtn.disabled = false;
            
            // 确保切换到拍照翻译标签
            translationMethodTabs.show();
            
            // 自动开始OCR识别
            extractTextFromImage(e.target.result);
        };
        reader.readAsDataURL(file);
    }

    // 清除图片
    clearImageBtn.addEventListener('click', function() {
        currentFile = null;
        previewImage.src = '#';
        imagePreview.classList.add('d-none');
        extractedText.value = '';
        translatedText.value = '';
        translateBtn.disabled = true;
    });

    // ==================== OCR文字识别功能 ====================
    function preProcessImage(imageSrc, quality) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = function() {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                // 根据质量设置调整图像大小和处理方式
                let width = img.width;
                let height = img.height;
                
                if (quality === 'high') {
                    // 高质量模式 - 保持原始尺寸
                    canvas.width = width;
                    canvas.height = height;
                } else if (quality === 'balanced') {
                    // 平衡模式 - 适当缩放以提高速度
                    const maxDimension = 1500;
                    if (width > maxDimension || height > maxDimension) {
                        if (width > height) {
                            height = Math.round(height * (maxDimension / width));
                            width = maxDimension;
                        } else {
                            width = Math.round(width * (maxDimension / height));
                            height = maxDimension;
                        }
                    }
                    canvas.width = width;
                    canvas.height = height;
                } else {
                    // 快速模式 - 较大缩放提高速度
                    const maxDimension = 1000;
                    if (width > maxDimension || height > maxDimension) {
                        if (width > height) {
                            height = Math.round(height * (maxDimension / width));
                            width = maxDimension;
                        } else {
                            width = Math.round(width * (maxDimension / height));
                            height = maxDimension;
                        }
                    }
                    canvas.width = width;
                    canvas.height = height;
                }
                
                // 绘制调整大小后的图像
                ctx.drawImage(img, 0, 0, width, height);
                
                // 应用图像增强
                if (quality !== 'fast') {
                    // 增加对比度
                    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                    const data = imageData.data;
                    
                    // 简单对比度增强
                    const contrast = 1.2; // 增加20%对比度
                    const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
                    
                    for (let i = 0; i < data.length; i += 4) {
                        data[i] = factor * (data[i] - 128) + 128; // 红
                        data[i + 1] = factor * (data[i + 1] - 128) + 128; // 绿
                        data[i + 2] = factor * (data[i + 2] - 128) + 128; // 蓝
                    }
                    
                    ctx.putImageData(imageData, 0, 0);
                }
                
                resolve(canvas.toDataURL('image/jpeg', 0.95));
            };
            img.src = imageSrc;
        });
    }

    function extractTextFromImage(imageSrc) {
        extractedText.value = '正在识别图片中的文字...';
        
        // 创建并添加进度条到页面
        ocrProgressBar.className = 'progress-bar progress-bar-striped progress-bar-animated';
        ocrProgressBar.style.width = '0%';
        ocrProgressBar.setAttribute('role', 'progressbar');
        ocrProgressBar.setAttribute('aria-valuemin', '0');
        ocrProgressBar.setAttribute('aria-valuemax', '100');
        
        const progressContainer = document.createElement('div');
        progressContainer.className = 'progress mt-2 mb-2';
        progressContainer.appendChild(ocrProgressBar);
        
        // 将进度条插入到提取文本区域上方
        extractedText.parentNode.insertBefore(progressContainer, extractedText);
        
        // 获取OCR质量设置
        const quality = ocrQualitySelector.value || 'balanced';
        
        // 预处理图像
        preProcessImage(imageSrc, quality).then(processedImage => {
            // 确定OCR配置
            const ocrConfig = {
                logger: m => {
                    if (m.status === 'recognizing text') {
                        const progress = Math.round(m.progress * 100);
                        ocrProgressBar.style.width = `${progress}%`;
                        ocrProgressBar.setAttribute('aria-valuenow', progress);
                        extractedText.value = `识别进度: ${progress}%`;
                    }
                }
            };
            
            // 根据质量选择不同配置
            if (quality === 'high') {
                ocrConfig.tessedit_pageseg_mode = '6'; // 假设单一均匀文本块
                ocrConfig.tessedit_ocr_engine_mode = '3'; // 使用LSTM引擎
            } else if (quality === 'balanced') {
                ocrConfig.tessedit_pageseg_mode = '3'; // 完全自动页面分割，但无OSD
            } else {
                ocrConfig.tessedit_pageseg_mode = '1'; // 自动页面分割与方向和脚本检测
                ocrConfig.tessedit_ocr_engine_mode = '2'; // 仅LSTM
            }
            
            // 选择正确的语言设置
            let langParam = 'chi_sim+eng';
            if (sourceLang.value !== 'auto') {
                if (sourceLang.value === 'eng') {
                    langParam = 'eng';
                } else if (sourceLang.value === 'chi_sim') {
                    langParam = 'chi_sim';
                } else if (sourceLang.value === 'jpn') {
                    langParam = 'jpn';
                } else if (sourceLang.value === 'kor') {
                    langParam = 'kor';
                }
            }
            
            return Tesseract.recognize(
                processedImage,
                langParam,
                ocrConfig
            );
        }).then(({ data: { text, words, lines } }) => {
            // 使用识别出的单词和行来智能处理文本
            let recognizedText = text.trim();
            
            // 移除多余的空行和空格
            recognizedText = recognizedText.replace(/\n{3,}/g, '\n\n');
            recognizedText = recognizedText.replace(/[ \t]+/g, ' ');
            
            // 显示提取的文本
            extractedText.value = recognizedText;
            
            // 如果有信息可提供，显示信息
            let confidenceLevel = '';
            if (words && words.length > 0) {
                // 计算平均置信度
                const totalConfidence = words.reduce((sum, word) => sum + word.confidence, 0);
                const avgConfidence = Math.round((totalConfidence / words.length) * 100) / 100;
                confidenceLevel = `识别置信度: ${avgConfidence}%`;
                
                // 在控制台记录低置信度单词以供参考
                const lowConfidenceWords = words.filter(word => word.confidence < 60);
                if (lowConfidenceWords.length > 0) {
                    console.log('低置信度单词:', lowConfidenceWords.map(w => w.text));
                }
            }
            
            // 移除进度条
            if (progressContainer && progressContainer.parentNode) {
                progressContainer.parentNode.removeChild(progressContainer);
            }
            
            // 将识别的文字发送到后端
            fetch('/api/recognized_text', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    text: recognizedText,
                    sourceLang: sourceLang.value,
                    confidence: confidenceLevel
                })
            })
            .then(response => response.json())
            .then(data => {
                console.log('识别文字已发送到后端:', data);
            })
            .catch(error => {
                console.error('发送识别文字到后端失败:', error);
            });
            
            // 如果OCR置信度很低，显示提示
            if (words && words.length > 0) {
                const avgConfidence = words.reduce((sum, word) => sum + word.confidence, 0) / words.length;
                if (avgConfidence < 50) {
                    alert('图像识别质量较低，您可能需要调整图像或使用更高质量的OCR设置重新识别');
                }
            }
        }).catch(err => {
            console.error(err);
            extractedText.value = '文字识别失败，请尝试其他图片或检查图片质量';
            
            // 移除进度条
            if (progressContainer && progressContainer.parentNode) {
                progressContainer.parentNode.removeChild(progressContainer);
            }
        });
    }

    // 添加OCR质量选择器的初始化
    if (!document.getElementById('ocr-quality')) {
        // 创建OCR质量选择器
        ocrQualitySelector.id = 'ocr-quality';
        ocrQualitySelector.className = 'form-select form-select-sm mt-2';
        
        // 添加选项
        const options = [
            { value: 'fast', text: '快速 (速度优先)' },
            { value: 'balanced', text: '平衡 (默认)' },
            { value: 'high', text: '高质量 (精度优先)' }
        ];
        
        options.forEach(opt => {
            const option = document.createElement('option');
            option.value = opt.value;
            option.textContent = opt.text;
            if (opt.value === 'balanced') option.selected = true;
            ocrQualitySelector.appendChild(option);
        });
        
        // 添加到DOM中的合适位置
        const configContainer = document.createElement('div');
        configContainer.className = 'mb-3';
        configContainer.innerHTML = '<label class="form-label">OCR识别质量</label>';
        configContainer.appendChild(ocrQualitySelector);
        
        // 添加到翻译按钮前面
        translateBtn.parentNode.insertBefore(configContainer, translateBtn);
    }

    // 添加"重新识别"按钮
    if (!document.getElementById('rerun-ocr')) {
        rerunOcrBtn.id = 'rerun-ocr';
        rerunOcrBtn.className = 'btn btn-outline-secondary btn-sm ms-2';
        rerunOcrBtn.innerHTML = '<i class="bi bi-arrow-repeat"></i> 重新识别';
        rerunOcrBtn.onclick = function() {
            if (currentFile) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    extractTextFromImage(e.target.result);
                };
                reader.readAsDataURL(currentFile);
            } else {
                alert('请先上传图片');
            }
        };
        
        // 添加到清除图片按钮旁边
        clearImageBtn.parentNode.insertBefore(rerunOcrBtn, clearImageBtn.nextSibling);
    }

    // ==================== 图片翻译功能 ====================
    function handleImageTranslation() {
        const textToTranslate = extractedText.value;
        if (!textToTranslate.trim()) {
            alert('没有可翻译的文字');
            return;
        }
        
        translatedText.value = '正在翻译...';
        
        // 调用后端翻译API
        fetch('/api/translate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                text: textToTranslate,
                sourceLang: sourceLang.value,
                targetLang: targetLang.value
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                translatedText.value = data.translated;
            } else {
                translatedText.value = `翻译失败: ${data.message || '请稍后重试'}`;
            }
        })
        .catch(err => {
            console.error(err);
            translatedText.value = '翻译失败，请稍后重试';
        });
    }

    // ==================== 键盘输入翻译功能 ====================
    // 监听实时翻译开关变化
    realTimeToggle.addEventListener('change', function() {
        realTimeTranslation = this.checked;
        if (realTimeTranslation && keyboardSource.value.trim()) {
            handleKeyboardTranslation();
        }
    });

    // 输入框事件监听 - 用于实时翻译
    keyboardSource.addEventListener('input', function() {
        if (realTimeTranslation) {
            clearTimeout(typingTimer);
            if (keyboardSource.value.trim()) {
                typingTimer = setTimeout(handleKeyboardTranslation, doneTypingInterval);
            } else {
                translatedText.value = '';
            }
        }
    });

    // 语言切换时触发实时翻译
    keyboardSourceLang.addEventListener('change', function() {
        if (realTimeTranslation && keyboardSource.value.trim()) {
            handleKeyboardTranslation();
        }
    });

    // 处理键盘输入的翻译
    function handleKeyboardTranslation() {
        const text = keyboardSource.value.trim();
        if (!text) {
            translatedText.value = '';
            return;
        }

        const sourceLangValue = keyboardSourceLang.value;
        const targetLangValue = targetLang.value;
        
        translatedText.value = '翻译中...';
        
        // 调用后端翻译API
        fetch('/api/translate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                text: text,
                sourceLang: sourceLangValue,
                targetLang: targetLangValue
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                translatedText.value = data.translated;
            } else {
                translatedText.value = `翻译失败: ${data.message || '请稍后重试'}`;
            }
        })
        .catch(err => {
            console.error('翻译错误:', err);
            translatedText.value = '翻译失败，请稍后重试';
        });
    }

    // ==================== 辅助功能 ====================
    // 复制翻译结果
    copyResultBtn.addEventListener('click', function() {
        if (!translatedText.value.trim()) {
            alert('没有可复制的内容');
            return;
        }
        
        translatedText.select();
        document.execCommand('copy');
        
        // 显示复制成功的反馈
        const originalText = copyResultBtn.innerHTML;
        copyResultBtn.innerHTML = '<i class="bi bi-check2"></i> 已复制';
        copyResultBtn.classList.add('btn-success');
        copyResultBtn.classList.remove('btn-outline-secondary');
        
        setTimeout(() => {
            copyResultBtn.innerHTML = originalText;
            copyResultBtn.classList.remove('btn-success');
            copyResultBtn.classList.add('btn-outline-secondary');
        }, 2000);
    });

    // 监听键盘快捷键 Ctrl+Enter 触发翻译
    keyboardSource.addEventListener('keydown', function(e) {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            handleKeyboardTranslation();
        }
    });
});