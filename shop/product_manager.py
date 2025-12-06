"""
Quản lý sản phẩm Quầy Lưu Niệm - Tiệm Bánh Netflix
Script Python với giao diện Tkinter để thêm/xóa sản phẩm

Yêu cầu cài đặt:
    pip install qrcode pillow
"""

import json
import os
import tkinter as tk
from tkinter import ttk, messagebox, filedialog
import shutil
import re
import io

# Kiểm tra và import thư viện tạo QR
try:
    import qrcode
    from PIL import Image
    QR_AVAILABLE = True
except ImportError:
    QR_AVAILABLE = False
    print("⚠️ Chưa cài đặt thư viện qrcode/pillow. Chạy: pip install qrcode pillow")

# Đường dẫn file
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PRODUCTS_FILE = os.path.join(SCRIPT_DIR, 'products.json')
PRODUCTS_JS_FILE = os.path.join(SCRIPT_DIR, 'products-data.js')
AFF_DATA_DIR = os.path.join(os.path.dirname(SCRIPT_DIR), 'aff-data')

def load_products():
    """Tải danh sách sản phẩm từ file JSON"""
    if os.path.exists(PRODUCTS_FILE):
        with open(PRODUCTS_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return []

def save_products(products):
    """Lưu danh sách sản phẩm vào file JSON và tạo file JS"""
    # Lưu JSON
    with open(PRODUCTS_FILE, 'w', encoding='utf-8') as f:
        json.dump(products, f, ensure_ascii=False, indent=4)
    
    # Tạo file JS để web có thể load trực tiếp
    js_content = "// Dữ liệu sản phẩm - Được tạo tự động bởi product_manager.py\n"
    js_content += "const productsData = " + json.dumps(products, ensure_ascii=False, indent=4) + ";\n"
    with open(PRODUCTS_JS_FILE, 'w', encoding='utf-8') as f:
        f.write(js_content)

def generate_id(name):
    """Tạo ID từ tên sản phẩm"""
    # Loại bỏ dấu tiếng Việt và ký tự đặc biệt
    id_str = name.lower()
    id_str = re.sub(r'[àáạảãâầấậẩẫăằắặẳẵ]', 'a', id_str)
    id_str = re.sub(r'[èéẹẻẽêềếệểễ]', 'e', id_str)
    id_str = re.sub(r'[ìíịỉĩ]', 'i', id_str)
    id_str = re.sub(r'[òóọỏõôồốộổỗơờớợởỡ]', 'o', id_str)
    id_str = re.sub(r'[ùúụủũưừứựửữ]', 'u', id_str)
    id_str = re.sub(r'[ỳýỵỷỹ]', 'y', id_str)
    id_str = re.sub(r'[đ]', 'd', id_str)
    id_str = re.sub(r'[^a-z0-9]', '_', id_str)
    id_str = re.sub(r'_+', '_', id_str).strip('_')
    return id_str

class ProductManagerApp:
    def __init__(self, root):
        self.root = root
        self.root.title("Quản lý sản phẩm - Quầy Lưu Niệm")
        self.root.geometry("900x700")
        self.root.configure(bg='#1a1a1a')
        
        self.products = load_products()
        self.selected_image = None
        self.editing_index = None  # Index sản phẩm đang chỉnh sửa
        
        self.setup_ui()
        self.refresh_product_list()
    
    def setup_ui(self):
        # Style
        style = ttk.Style()
        style.theme_use('clam')
        style.configure('TFrame', background='#1a1a1a')
        style.configure('TLabel', background='#1a1a1a', foreground='white', font=('Segoe UI', 10))
        style.configure('TButton', font=('Segoe UI', 10))
        style.configure('Header.TLabel', font=('Segoe UI', 14, 'bold'), foreground='#e50914')
        
        # Main container
        main_frame = ttk.Frame(self.root, padding=20)
        main_frame.pack(fill=tk.BOTH, expand=True)
        
        # Header
        header = ttk.Label(main_frame, text="🎁 QUẢN LÝ SẢN PHẨM - QUẦY LƯU NIỆM", style='Header.TLabel')
        header.pack(pady=(0, 20))
        
        # Left panel - Product list
        left_frame = ttk.Frame(main_frame)
        left_frame.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=(0, 10))
        
        ttk.Label(left_frame, text="Danh sách sản phẩm:").pack(anchor=tk.W)
        
        # Listbox với scrollbar
        list_frame = ttk.Frame(left_frame)
        list_frame.pack(fill=tk.BOTH, expand=True, pady=5)
        
        scrollbar = ttk.Scrollbar(list_frame)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
        
        self.product_listbox = tk.Listbox(
            list_frame, 
            bg='#2a2a2a', 
            fg='white',
            selectbackground='#e50914',
            font=('Segoe UI', 10),
            yscrollcommand=scrollbar.set
        )
        self.product_listbox.pack(fill=tk.BOTH, expand=True)
        scrollbar.config(command=self.product_listbox.yview)
        self.product_listbox.bind('<<ListboxSelect>>', self.on_select_product)
        
        # Buttons frame
        btn_frame = ttk.Frame(left_frame)
        btn_frame.pack(fill=tk.X, pady=10)
        
        # Edit button
        edit_btn = tk.Button(
            btn_frame, 
            text="✏️ Sửa",
            bg='#fbbf24', 
            fg='black',
            font=('Segoe UI', 10, 'bold'),
            command=self.edit_product
        )
        edit_btn.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(0, 5))
        
        # Delete button
        delete_btn = tk.Button(
            btn_frame, 
            text="🗑️ Xóa",
            bg='#dc3545', 
            fg='white',
            font=('Segoe UI', 10, 'bold'),
            command=self.delete_product
        )
        delete_btn.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(5, 0))
        
        # Right panel - Add/Edit form
        right_frame = ttk.Frame(main_frame)
        right_frame.pack(side=tk.RIGHT, fill=tk.BOTH, expand=True, padx=(10, 0))
        
        self.form_title = ttk.Label(right_frame, text="Thêm sản phẩm mới:", style='Header.TLabel')
        self.form_title.pack(anchor=tk.W, pady=(0, 10))
        
        # Form fields
        fields_frame = ttk.Frame(right_frame)
        fields_frame.pack(fill=tk.X)
        
        # Tên sản phẩm
        ttk.Label(fields_frame, text="Tên sản phẩm:").pack(anchor=tk.W)
        self.name_entry = tk.Entry(fields_frame, bg='#2a2a2a', fg='white', insertbackground='white', font=('Segoe UI', 10))
        self.name_entry.pack(fill=tk.X, pady=(0, 10))
        
        # Giá hiện tại
        ttk.Label(fields_frame, text="Giá hiện tại (VD: 462.000đ):").pack(anchor=tk.W)
        self.price_now_entry = tk.Entry(fields_frame, bg='#2a2a2a', fg='white', insertbackground='white', font=('Segoe UI', 10))
        self.price_now_entry.pack(fill=tk.X, pady=(0, 10))
        
        # Giá gốc
        ttk.Label(fields_frame, text="Giá gốc (VD: 599.000đ):").pack(anchor=tk.W)
        self.price_original_entry = tk.Entry(fields_frame, bg='#2a2a2a', fg='white', insertbackground='white', font=('Segoe UI', 10))
        self.price_original_entry.pack(fill=tk.X, pady=(0, 10))
        
        # Giảm giá
        ttk.Label(fields_frame, text="Phần trăm giảm (VD: -23%):").pack(anchor=tk.W)
        self.discount_entry = tk.Entry(fields_frame, bg='#2a2a2a', fg='white', insertbackground='white', font=('Segoe UI', 10))
        self.discount_entry.pack(fill=tk.X, pady=(0, 10))
        
        # Link mua
        ttk.Label(fields_frame, text="Link mua hàng (Shopee/Lazada...):").pack(anchor=tk.W)
        self.buy_link_entry = tk.Entry(fields_frame, bg='#2a2a2a', fg='white', insertbackground='white', font=('Segoe UI', 10))
        self.buy_link_entry.pack(fill=tk.X, pady=(0, 10))
        
        # Ảnh sản phẩm
        img_frame = ttk.Frame(fields_frame)
        img_frame.pack(fill=tk.X, pady=(0, 10))
        ttk.Label(img_frame, text="Ảnh sản phẩm:").pack(side=tk.LEFT)
        self.image_label = ttk.Label(img_frame, text="Chưa chọn", foreground='#888')
        self.image_label.pack(side=tk.LEFT, padx=10)
        tk.Button(img_frame, text="Chọn ảnh", command=self.select_image, bg='#333', fg='white').pack(side=tk.RIGHT)
        
        # QR code - Tự động tạo từ link
        qr_frame = ttk.Frame(fields_frame)
        qr_frame.pack(fill=tk.X, pady=(0, 10))
        qr_status = "✅ Tự động tạo từ link mua hàng" if QR_AVAILABLE else "⚠️ Cần cài: pip install qrcode pillow"
        qr_color = '#4ade80' if QR_AVAILABLE else '#fbbf24'
        ttk.Label(qr_frame, text="QR code:").pack(side=tk.LEFT)
        ttk.Label(qr_frame, text=qr_status, foreground=qr_color).pack(side=tk.LEFT, padx=10)
        
        # Mô tả sản phẩm
        ttk.Label(fields_frame, text="Mô tả sản phẩm (mỗi dòng là 1 mục):").pack(anchor=tk.W)
        self.desc_text = tk.Text(fields_frame, height=6, bg='#2a2a2a', fg='white', insertbackground='white', font=('Segoe UI', 10))
        self.desc_text.pack(fill=tk.X, pady=(0, 10))
        
        # Add/Save button
        self.save_btn = tk.Button(
            fields_frame, 
            text="➕ THÊM SẢN PHẨM",
            bg='#28a745', 
            fg='white',
            font=('Segoe UI', 12, 'bold'),
            command=self.save_product
        )
        self.save_btn.pack(fill=tk.X, pady=10)
        
        # Clear/Cancel button
        self.clear_btn = tk.Button(
            fields_frame, 
            text="🔄 Xóa form",
            bg='#6c757d', 
            fg='white',
            font=('Segoe UI', 10),
            command=self.clear_form
        )
        self.clear_btn.pack(fill=tk.X)
    
    def refresh_product_list(self):
        """Cập nhật danh sách sản phẩm"""
        self.product_listbox.delete(0, tk.END)
        for i, product in enumerate(self.products):
            self.product_listbox.insert(tk.END, f"{i+1}. {product['name']} - {product['priceNow']}")
    
    def on_select_product(self, event):
        """Khi chọn sản phẩm trong danh sách - double click để sửa"""
        pass
    
    def edit_product(self):
        """Chỉnh sửa sản phẩm đã chọn"""
        selection = self.product_listbox.curselection()
        if not selection:
            messagebox.showwarning("Cảnh báo", "Vui lòng chọn sản phẩm cần sửa!")
            return
        
        index = selection[0]
        product = self.products[index]
        self.editing_index = index
        
        # Điền thông tin vào form
        self.clear_form()
        self.name_entry.insert(0, product.get('name', ''))
        self.price_now_entry.insert(0, product.get('priceNow', ''))
        self.price_original_entry.insert(0, product.get('priceOriginal', ''))
        self.discount_entry.insert(0, product.get('discount', ''))
        self.buy_link_entry.insert(0, product.get('buyLink', ''))
        
        # Mô tả
        desc = product.get('description', [])
        if desc:
            self.desc_text.insert("1.0", '\n'.join(desc))
        
        # Hiển thị ảnh hiện tại
        if product.get('image'):
            self.image_label.config(text=f"Giữ nguyên: {os.path.basename(product['image'])}", foreground='#4ade80')
        
        # Đổi giao diện sang chế độ sửa
        self.form_title.config(text=f"Chỉnh sửa: {product['name']}")
        self.save_btn.config(text="💾 LƯU THAY ĐỔI", bg='#fbbf24', fg='black')
        self.clear_btn.config(text="❌ Hủy chỉnh sửa")
    
    def select_image(self):
        """Chọn ảnh sản phẩm"""
        file_path = filedialog.askopenfilename(
            title="Chọn ảnh sản phẩm",
            filetypes=[("Image files", "*.png *.jpg *.jpeg *.webp *.gif")]
        )
        if file_path:
            self.selected_image = file_path
            self.image_label.config(text=os.path.basename(file_path), foreground='#4ade80')
    
    
    def save_product(self):
        """Thêm hoặc cập nhật sản phẩm"""
        if self.editing_index is not None:
            self.update_product()
        else:
            self.add_product()
    
    def update_product(self):
        """Cập nhật sản phẩm đang chỉnh sửa"""
        name = self.name_entry.get().strip()
        price_now = self.price_now_entry.get().strip()
        price_original = self.price_original_entry.get().strip()
        discount = self.discount_entry.get().strip()
        buy_link = self.buy_link_entry.get().strip()
        description = self.desc_text.get("1.0", tk.END).strip()
        
        if not name or not price_now or not buy_link:
            messagebox.showerror("Lỗi", "Vui lòng điền đầy đủ thông tin!")
            return
        
        product = self.products[self.editing_index]
        
        # Cập nhật thông tin
        product['name'] = name
        product['priceNow'] = price_now
        product['priceOriginal'] = price_original
        product['discount'] = discount
        product['buyLink'] = buy_link
        product['description'] = [line.strip() for line in description.split('\n') if line.strip()]
        
        # Nếu chọn ảnh mới
        if self.selected_image:
            os.makedirs(AFF_DATA_DIR, exist_ok=True)
            img_ext = os.path.splitext(self.selected_image)[1]
            img_filename = f"{product['id']}{img_ext}"
            img_dest = os.path.join(AFF_DATA_DIR, img_filename)
            shutil.copy2(self.selected_image, img_dest)
            product['image'] = f"../aff-data/{img_filename}"
        
        # Tạo lại QR nếu link thay đổi
        if QR_AVAILABLE and buy_link:
            try:
                qr = qrcode.QRCode(version=1, box_size=10, border=2)
                qr.add_data(buy_link)
                qr.make(fit=True)
                qr_img = qr.make_image(fill_color="black", back_color="white")
                qr_filename = f"{product['id']}_qr.webp"
                qr_dest = os.path.join(AFF_DATA_DIR, qr_filename)
                qr_img.save(qr_dest, 'WEBP', quality=90)
                product['qrImage'] = f"../aff-data/{qr_filename}"
            except Exception as e:
                print(f"Lỗi tạo QR: {e}")
        
        save_products(self.products)
        messagebox.showinfo("Thành công", f"Đã cập nhật sản phẩm: {name}")
        self.clear_form()
        self.refresh_product_list()
    
    def add_product(self):
        """Thêm sản phẩm mới"""
        name = self.name_entry.get().strip()
        price_now = self.price_now_entry.get().strip()
        price_original = self.price_original_entry.get().strip()
        discount = self.discount_entry.get().strip()
        buy_link = self.buy_link_entry.get().strip()
        description = self.desc_text.get("1.0", tk.END).strip()
        
        # Validate
        if not name:
            messagebox.showerror("Lỗi", "Vui lòng nhập tên sản phẩm!")
            return
        if not price_now:
            messagebox.showerror("Lỗi", "Vui lòng nhập giá sản phẩm!")
            return
        if not buy_link:
            messagebox.showerror("Lỗi", "Vui lòng nhập link mua hàng!")
            return
        if not self.selected_image:
            messagebox.showerror("Lỗi", "Vui lòng chọn ảnh sản phẩm!")
            return
        
        # Tạo ID
        product_id = generate_id(name)
        
        # Đảm bảo thư mục aff-data tồn tại
        os.makedirs(AFF_DATA_DIR, exist_ok=True)
        
        # Copy ảnh sản phẩm
        img_ext = os.path.splitext(self.selected_image)[1]
        img_filename = f"{product_id}{img_ext}"
        img_dest = os.path.join(AFF_DATA_DIR, img_filename)
        shutil.copy2(self.selected_image, img_dest)
        
        # Tự động tạo QR code từ link mua hàng
        qr_path = ""
        if QR_AVAILABLE and buy_link:
            try:
                qr = qrcode.QRCode(version=1, box_size=10, border=2)
                qr.add_data(buy_link)
                qr.make(fit=True)
                qr_img = qr.make_image(fill_color="black", back_color="white")
                
                # Lưu dưới dạng webp
                qr_filename = f"{product_id}_qr.webp"
                qr_dest = os.path.join(AFF_DATA_DIR, qr_filename)
                qr_img.save(qr_dest, 'WEBP', quality=90)
                qr_path = f"../aff-data/{qr_filename}"
            except Exception as e:
                print(f"Lỗi tạo QR: {e}")
        
        # Tạo object sản phẩm
        new_product = {
            "id": product_id,
            "name": name,
            "image": f"../aff-data/{img_filename}",
            "qrImage": qr_path,
            "priceNow": price_now,
            "priceOriginal": price_original,
            "discount": discount,
            "buyLink": buy_link,
            "description": [line.strip() for line in description.split('\n') if line.strip()]
        }
        
        self.products.append(new_product)
        save_products(self.products)
        
        messagebox.showinfo("Thành công", f"Đã thêm sản phẩm: {name}")
        self.clear_form()
        self.refresh_product_list()
    
    def delete_product(self):
        """Xóa sản phẩm đã chọn"""
        selection = self.product_listbox.curselection()
        if not selection:
            messagebox.showwarning("Cảnh báo", "Vui lòng chọn sản phẩm cần xóa!")
            return
        
        index = selection[0]
        product = self.products[index]
        
        if messagebox.askyesno("Xác nhận", f"Bạn có chắc muốn xóa sản phẩm:\n{product['name']}?"):
            # Xóa ảnh nếu có
            try:
                img_path = os.path.join(SCRIPT_DIR, '..', product['image'].replace('../', ''))
                if os.path.exists(img_path):
                    os.remove(img_path)
                if product.get('qrImage'):
                    qr_path = os.path.join(SCRIPT_DIR, '..', product['qrImage'].replace('../', ''))
                    if os.path.exists(qr_path):
                        os.remove(qr_path)
            except Exception as e:
                print(f"Lỗi xóa ảnh: {e}")
            
            del self.products[index]
            save_products(self.products)
            messagebox.showinfo("Thành công", "Đã xóa sản phẩm!")
            self.refresh_product_list()
    
    def clear_form(self):
        """Xóa form nhập liệu và reset về chế độ thêm mới"""
        self.name_entry.delete(0, tk.END)
        self.price_now_entry.delete(0, tk.END)
        self.price_original_entry.delete(0, tk.END)
        self.discount_entry.delete(0, tk.END)
        self.buy_link_entry.delete(0, tk.END)
        self.desc_text.delete("1.0", tk.END)
        self.selected_image = None
        self.editing_index = None
        self.image_label.config(text="Chưa chọn", foreground='#888')
        
        # Reset giao diện về chế độ thêm mới
        self.form_title.config(text="Thêm sản phẩm mới:")
        self.save_btn.config(text="➕ THÊM SẢN PHẨM", bg='#28a745', fg='white')
        self.clear_btn.config(text="🔄 Xóa form")

if __name__ == "__main__":
    root = tk.Tk()
    app = ProductManagerApp(root)
    root.mainloop()
