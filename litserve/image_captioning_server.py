import torch
from PIL import Image
from transformers import VisionEncoderDecoderModel, ViTImageProcessor, GPT2TokenizerFast
import os

class ImageCaptionGenerator:
    def __init__(self):
        # 设置本地路径
        self.model_path = "./models/vit-gpt2-image-captioning"
        self.image_dir = "./image"
        
        # 自动选择设备
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        
        # 加载本地模型资源
        self.load_models()

    def load_models(self):
        """加载本地模型和处理器"""
        try:
            self.model = VisionEncoderDecoderModel.from_pretrained(
                self.model_path
            ).to(self.device)
            
            self.tokenizer = GPT2TokenizerFast.from_pretrained(
                self.model_path
            )
            
            self.image_processor = ViTImageProcessor.from_pretrained(
                self.model_path
            )
            
            print("成功加载本地模型和处理器")
        except Exception as e:
            raise RuntimeError(f"模型加载失败: {str(e)}")

    def process_image(self, image_path):
        """处理单个图片文件"""
        try:
            # 加载图片
            image = Image.open(image_path)
            
            # 预处理
            img_tensor = self.image_processor(
                image.convert("RGB"), 
                return_tensors="pt"
            ).to(self.device)

            # 生成描述
            output = self.model.generate(
                **img_tensor,
                max_length=50,
                num_beams=4,
                early_stopping=True
            )
            
            # 解码结果
            caption = self.tokenizer.decode(output[0], skip_special_tokens=True)
            return caption
            
        except Exception as e:
            return f"处理图片失败: {str(e)}"

    def process_directory(self):
        """批量处理目录中的所有图片"""
        # 获取所有图片文件
        image_files = [
            f for f in os.listdir(self.image_dir)
            if f.lower().endswith(('.png', '.jpg', '.jpeg'))
        ]
        
        if not image_files:
            print("未找到图片文件")
            return

        # 处理每个文件
        results = []
        for filename in image_files:
            filepath = os.path.join(self.image_dir, filename)
            caption = self.process_image(filepath)
            results.append((filename, caption))
            print(f"图片: {filename}")
            print(f"描述: {caption}\n")
        
        return results

if __name__ == "__main__":
    # 初始化生成器
    generator = ImageCaptionGenerator()
    
    # 处理全部图片
    print("开始处理图片...")
    results = generator.process_directory()
    
    print("处理完成，结果已保存到 descriptions.txt")