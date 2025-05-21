from flask import Flask, request, jsonify, render_template
import os
import sys
import numpy as np
import pickle
import jieba

# 将当前目录添加到系统路径
app_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.append(app_dir)
os.chdir(app_dir)  # 改变当前工作目录

# 初始化Flask应用
app = Flask(__name__, 
            static_folder=r'MachineTranslation-Transformer-master\static',
            template_folder=r'MachineTranslation-Transformer-master\templates')

# 全局变量
MODEL_LOADED = False
source_token_dict = {}
target_token_dict = {}
target_token_dict_inv = {}
model = None

# 加载模型和词汇表
def load_model_and_dicts():
    global MODEL_LOADED, source_token_dict, target_token_dict, target_token_dict_inv, model
    
    try:
        # 导入keras_transformer模块
        from keras_transformer import get_model, decode
        
        # 加载词汇表
        path = 'MachineTranslation-Transformer-master/middle_data/'
        with open(path + 'source_token_dict.pkl', 'rb') as f:
            source_token_dict = pickle.load(f)
        
        with open(path + 'target_token_dict.pkl', 'rb') as f:
            target_token_dict = pickle.load(f)
        
        # 创建反向映射词典
        target_token_dict_inv = {v: k for k, v in target_token_dict.items()}
        
        # 加载模型
        model = get_model(
            token_num=max(len(source_token_dict), len(target_token_dict)),
            embed_dim=64,
            encoder_num=2,
            decoder_num=2,
            head_num=4,
            hidden_dim=256,
            dropout_rate=0.05,
            use_same_embed=False,
        )
        
        # 加载已训练的权重
        model.load_weights(r'MachineTranslation-Transformer-master\models\W-- 87-0.0218-.weights.h5')
        
        MODEL_LOADED = True
        print("模型和词汇表加载成功")
        return True
    except Exception as e:
        print(f"模型加载失败: {str(e)}")
        return False

# 尝试加载模型，如果失败则使用模拟模式
try:
    load_model_and_dicts()
except Exception as e:
    print(f"无法加载模型和词汇表，将使用模拟模式: {str(e)}")

# 定义预处理函数
def get_input(seq):
    """
    处理输入文本，转换为模型可接受的格式
    """
    seq = ' '.join(jieba.lcut(seq, cut_all=False))  # 分词
    seq = seq.split(' ')  # 将分词结果转换为列表
    
    seq = ['<START>'] + seq + ['<END>']  # 添加开始和结束标记
    
    # 固定长度处理
    if len(seq) >= 34:
        seq = seq[:32] + ['<END>']  # 如果长度超过34，则截断
    else:
        seq = seq + ['<PAD>'] * (34 - len(seq))  # 填充到固定长度
    
    # 检查词汇是否都在词典中
    flag = True
    for x in seq:
        if x not in source_token_dict:
            flag = False
            break
    
    if flag:
        seq = [source_token_dict[x] for x in seq]  # 将词汇转换为对应的数字ID
    
    return flag, seq

# 定义翻译函数
def translate_text(seq):
    """
    使用模型翻译文本
    """
    from keras_transformer import decode
    
    if not MODEL_LOADED:
        return "模型未加载，无法提供翻译服务"
    
    try:
        decoded = decode(
            model,
            [seq],
            start_token=target_token_dict['<START>'],
            end_token=target_token_dict['<END>'],
            pad_token=target_token_dict['<PAD>'],
        )
        
        # 将翻译结果转换为文本
        translated_text = ' '.join(map(lambda x: target_token_dict_inv[x], decoded[0][1:-1]))
        return translated_text
    except Exception as e:
        print(f"翻译过程中出错: {str(e)}")
        return f"翻译错误: {str(e)}"

@app.route('/')
def index():
    """
    渲染主页
    """
    return render_template('index.html')

@app.route('/api/recognized_text', methods=['POST'])
def receive_recognized_text():
    """
    接收前端识别的文字
    """
    data = request.json
    text = data.get('text', '')
    sourceLang = data.get('sourceLang', 'auto')
    
    # 这里可以对识别出的文字进行处理或保存
    print(f"收到识别的文字: {text}")
    
    return jsonify({
        'status': 'success',
        'received': text
    })

@app.route('/api/translate', methods=['POST'])
def handle_translation():
    """
    翻译接口
    """
    data = request.json
    text = data.get('text', '')
    sourceLang = data.get('sourceLang', 'auto')
    targetLang = data.get('targetLang', 'zh')
    
    # 如果文本为空，返回错误
    if not text.strip():
        return jsonify({
            'status': 'error',
            'message': '文本不能为空'
        })
    
    # 判断是否支持的语言对
    supported = False
    if MODEL_LOADED:
        # 这里根据实际情况定义支持的语言对
        if (sourceLang == 'zh' and targetLang == 'en') or \
           (sourceLang == 'en' and targetLang == 'zh') or \
           (sourceLang == 'auto'):
            supported = True
    
    if supported:
        # 使用我们的模型进行翻译
        try:
            flag, processed_seq = get_input(text)
            if flag:
                translated = translate_text(processed_seq)
            else:
                # 如果包含不在词汇表中的词语，返回错误
                return jsonify({
                    'status': 'error',
                    'message': '包含不在词汇表中的词语，无法翻译'
                })
        except Exception as e:
            print(f"翻译过程中出错: {str(e)}")
            return jsonify({
                'status': 'error',
                'message': f'翻译过程中出错: {str(e)}'
            })
    else:
        # 如果不支持该语言对或模型未加载，返回模拟结果
        translated = f"[模拟翻译 {sourceLang} → {targetLang}] {text}"
    
    return jsonify({
        'status': 'success',
        'original': text,
        'translated': translated,
        'sourceLang': sourceLang,
        'targetLang': targetLang
    })

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
    