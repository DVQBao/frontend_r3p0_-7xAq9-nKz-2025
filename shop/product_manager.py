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
FEATURED_FILE = os.path.join(SCRIPT_DIR, 'featured-products.json')
FEATURED_JS_FILE = os.path.join(SCRIPT_DIR, 'featured-products.js')
AFF_DATA_DIR = os.path.join(os.path.dirname(SCRIPT_DIR), 'aff-data')

def load_products():
    """Tải danh sách sản phẩm từ file JSON"""
    if os.path.exists(PRODUCTS_FILE):
        with open(PRODUCTS_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return []

def load_featured():
    """Tải danh sách sản phẩm featured cho modal"""
    if os.path.exists(FEATURED_FILE):
        with open(FEATURED_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return []

def save_featured(featured_products):
    """Lưu danh sách sản phẩm featured vào file JSON và JS"""
    # Lưu JSON
    with open(FEATURED_FILE, 'w', encoding='utf-8') as f:
        json.dump(featured_products, f, ensure_ascii=False, indent=4)
    
    # Tạo file JS để web có thể load trực tiếp
    js_content = "// Sản phẩm hiển thị trong Modal quảng cáo - Được tạo tự động bởi product_manager.py\n"
    js_content += "// Chứa 4 sản phẩm được chọn để hiển thị trong các modal trên trang chủ\n"
    js_content += "const featuredProducts = " + json.dumps(featured_products, ensure_ascii=False, indent=4) + ";\n"
    with open(FEATURED_JS_FILE, 'w', encoding='utf-8') as f:
        f.write(js_content)

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
        self.root.geometry("950x750")
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
        
        # Buttons frame - Row 1: Edit & Delete
        btn_frame = ttk.Frame(left_frame)
        btn_frame.pack(fill=tk.X, pady=(10, 5))
        
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
        
        # Separator
        ttk.Separator(left_frame, orient='horizontal').pack(fill=tk.X, pady=10)
        
        # Label cho phần sắp xếp
        ttk.Label(left_frame, text="📍 Sắp xếp vị trí:", font=('Segoe UI', 10, 'bold')).pack(anchor=tk.W)
        
        # Buttons frame - Row 2: Move Up & Move Down
        move_frame = ttk.Frame(left_frame)
        move_frame.pack(fill=tk.X, pady=5)
        
        # Move to top button
        move_top_btn = tk.Button(
            move_frame, 
            text="⏫ Đầu",
            bg='#8b5cf6', 
            fg='white',
            font=('Segoe UI', 9, 'bold'),
            command=self.move_to_top
        )
        move_top_btn.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(0, 2))
        
        # Move up button
        move_up_btn = tk.Button(
            move_frame, 
            text="🔼 Lên",
            bg='#3b82f6', 
            fg='white',
            font=('Segoe UI', 9, 'bold'),
            command=self.move_up
        )
        move_up_btn.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=2)
        
        # Move down button
        move_down_btn = tk.Button(
            move_frame, 
            text="🔽 Xuống",
            bg='#3b82f6', 
            fg='white',
            font=('Segoe UI', 9, 'bold'),
            command=self.move_down
        )
        move_down_btn.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=2)
        
        # Move to bottom button
        move_bottom_btn = tk.Button(
            move_frame, 
            text="⏬ Cuối",
            bg='#8b5cf6', 
            fg='white',
            font=('Segoe UI', 9, 'bold'),
            command=self.move_to_bottom
        )
        move_bottom_btn.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(2, 0))
        
        # Buttons frame - Row 3: Move to specific position
        position_frame = ttk.Frame(left_frame)
        position_frame.pack(fill=tk.X, pady=5)
        
        ttk.Label(position_frame, text="Đến vị trí:", font=('Segoe UI', 9)).pack(side=tk.LEFT)
        
        self.position_entry = tk.Entry(
            position_frame, 
            bg='#2a2a2a', 
            fg='white', 
            insertbackground='white',
            font=('Segoe UI', 10),
            width=5
        )
        self.position_entry.pack(side=tk.LEFT, padx=5)
        self.position_entry.bind('<Return>', lambda e: self.move_to_position())
        
        move_to_btn = tk.Button(
            position_frame, 
            text="📍 Di chuyển",
            bg='#10b981', 
            fg='white',
            font=('Segoe UI', 9, 'bold'),
            command=self.move_to_position
        )
        move_to_btn.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(5, 0))
        
        # Separator
        ttk.Separator(left_frame, orient='horizontal').pack(fill=tk.X, pady=10)
        
        # Button quản lý Modal
        modal_btn = tk.Button(
            left_frame, 
            text="📢 QUẢN LÝ MODAL QUẢNG CÁO",
            bg='#e50914', 
            fg='white',
            font=('Segoe UI', 10, 'bold'),
            command=self.open_modal_manager
        )
        modal_btn.pack(fill=tk.X, pady=5)
        
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
        """Khi chọn sản phẩm trong danh sách"""
        # Cập nhật gợi ý vị trí trong ô nhập
        selection = self.product_listbox.curselection()
        if selection:
            current_pos = selection[0] + 1
            self.position_entry.delete(0, tk.END)
            self.position_entry.insert(0, str(current_pos))
    
    def move_up(self):
        """Di chuyển sản phẩm lên 1 vị trí"""
        selection = self.product_listbox.curselection()
        if not selection:
            messagebox.showwarning("Cảnh báo", "Vui lòng chọn sản phẩm cần di chuyển!")
            return
        
        index = selection[0]
        if index == 0:
            messagebox.showinfo("Thông báo", "Sản phẩm đã ở vị trí đầu tiên!")
            return
        
        # Hoán đổi vị trí
        self.products[index], self.products[index - 1] = self.products[index - 1], self.products[index]
        save_products(self.products)
        self.refresh_product_list()
        
        # Giữ selection ở vị trí mới
        self.product_listbox.selection_set(index - 1)
        self.product_listbox.see(index - 1)
        self.position_entry.delete(0, tk.END)
        self.position_entry.insert(0, str(index))
    
    def move_down(self):
        """Di chuyển sản phẩm xuống 1 vị trí"""
        selection = self.product_listbox.curselection()
        if not selection:
            messagebox.showwarning("Cảnh báo", "Vui lòng chọn sản phẩm cần di chuyển!")
            return
        
        index = selection[0]
        if index >= len(self.products) - 1:
            messagebox.showinfo("Thông báo", "Sản phẩm đã ở vị trí cuối cùng!")
            return
        
        # Hoán đổi vị trí
        self.products[index], self.products[index + 1] = self.products[index + 1], self.products[index]
        save_products(self.products)
        self.refresh_product_list()
        
        # Giữ selection ở vị trí mới
        self.product_listbox.selection_set(index + 1)
        self.product_listbox.see(index + 1)
        self.position_entry.delete(0, tk.END)
        self.position_entry.insert(0, str(index + 2))
    
    def move_to_top(self):
        """Di chuyển sản phẩm lên đầu danh sách"""
        selection = self.product_listbox.curselection()
        if not selection:
            messagebox.showwarning("Cảnh báo", "Vui lòng chọn sản phẩm cần di chuyển!")
            return
        
        index = selection[0]
        if index == 0:
            messagebox.showinfo("Thông báo", "Sản phẩm đã ở vị trí đầu tiên!")
            return
        
        # Lấy sản phẩm ra và chèn vào đầu
        product = self.products.pop(index)
        self.products.insert(0, product)
        save_products(self.products)
        self.refresh_product_list()
        
        # Chọn sản phẩm ở vị trí mới
        self.product_listbox.selection_set(0)
        self.product_listbox.see(0)
        self.position_entry.delete(0, tk.END)
        self.position_entry.insert(0, "1")
        
        messagebox.showinfo("Thành công", f"Đã đưa '{product['name']}' lên đầu danh sách!")
    
    def move_to_bottom(self):
        """Di chuyển sản phẩm xuống cuối danh sách"""
        selection = self.product_listbox.curselection()
        if not selection:
            messagebox.showwarning("Cảnh báo", "Vui lòng chọn sản phẩm cần di chuyển!")
            return
        
        index = selection[0]
        if index >= len(self.products) - 1:
            messagebox.showinfo("Thông báo", "Sản phẩm đã ở vị trí cuối cùng!")
            return
        
        # Lấy sản phẩm ra và thêm vào cuối
        product = self.products.pop(index)
        self.products.append(product)
        save_products(self.products)
        self.refresh_product_list()
        
        # Chọn sản phẩm ở vị trí mới
        new_index = len(self.products) - 1
        self.product_listbox.selection_set(new_index)
        self.product_listbox.see(new_index)
        self.position_entry.delete(0, tk.END)
        self.position_entry.insert(0, str(new_index + 1))
        
        messagebox.showinfo("Thành công", f"Đã đưa '{product['name']}' xuống cuối danh sách!")
    
    def move_to_position(self):
        """Di chuyển sản phẩm đến vị trí cụ thể"""
        selection = self.product_listbox.curselection()
        if not selection:
            messagebox.showwarning("Cảnh báo", "Vui lòng chọn sản phẩm cần di chuyển!")
            return
        
        # Lấy vị trí đích từ ô nhập
        try:
            target_pos = int(self.position_entry.get().strip())
        except ValueError:
            messagebox.showerror("Lỗi", "Vui lòng nhập số vị trí hợp lệ!")
            return
        
        # Validate vị trí
        if target_pos < 1 or target_pos > len(self.products):
            messagebox.showerror("Lỗi", f"Vị trí phải từ 1 đến {len(self.products)}!")
            return
        
        current_index = selection[0]
        target_index = target_pos - 1  # Chuyển từ 1-based sang 0-based
        
        if current_index == target_index:
            messagebox.showinfo("Thông báo", "Sản phẩm đã ở vị trí này!")
            return
        
        # Lấy sản phẩm ra và chèn vào vị trí mới
        product = self.products.pop(current_index)
        self.products.insert(target_index, product)
        save_products(self.products)
        self.refresh_product_list()
        
        # Chọn sản phẩm ở vị trí mới
        self.product_listbox.selection_set(target_index)
        self.product_listbox.see(target_index)
        
        direction = "lên" if target_index < current_index else "xuống"
        messagebox.showinfo("Thành công", f"Đã di chuyển '{product['name']}' {direction} vị trí {target_pos}!")
    
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
    
    def open_modal_manager(self):
        """Mở cửa sổ quản lý Modal quảng cáo"""
        ModalManagerWindow(self.root, self.products)


class ModalManagerWindow:
    """Cửa sổ quản lý sản phẩm hiển thị trong Modal quảng cáo"""
    
    def __init__(self, parent, products):
        self.products = products
        self.featured = load_featured()
        
        # Tạo cửa sổ mới
        self.window = tk.Toplevel(parent)
        self.window.title("📢 Quản lý Modal Quảng cáo")
        self.window.geometry("700x550")
        self.window.configure(bg='#1a1a1a')
        self.window.transient(parent)
        self.window.grab_set()
        
        self.setup_ui()
        self.refresh_lists()
    
    def setup_ui(self):
        # Style
        style = ttk.Style()
        style.configure('Modal.TLabel', background='#1a1a1a', foreground='white', font=('Segoe UI', 10))
        style.configure('ModalHeader.TLabel', background='#1a1a1a', foreground='#e50914', font=('Segoe UI', 12, 'bold'))
        
        # Main container
        main_frame = ttk.Frame(self.window, padding=20)
        main_frame.pack(fill=tk.BOTH, expand=True)
        main_frame.configure(style='TFrame')
        
        # Header
        header = ttk.Label(
            main_frame, 
            text="📢 QUẢN LÝ SẢN PHẨM TRONG MODAL QUẢNG CÁO",
            style='ModalHeader.TLabel'
        )
        header.pack(pady=(0, 5))
        
        # Mô tả
        desc = ttk.Label(
            main_frame,
            text="Chọn 4 sản phẩm để hiển thị trong modal quảng cáo trên trang chủ",
            style='Modal.TLabel'
        )
        desc.pack(pady=(0, 15))
        
        # Container cho 2 cột
        columns_frame = ttk.Frame(main_frame)
        columns_frame.pack(fill=tk.BOTH, expand=True)
        
        # === Cột trái: Sản phẩm đang hiển thị trong Modal ===
        left_frame = ttk.Frame(columns_frame)
        left_frame.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=(0, 10))
        
        ttk.Label(
            left_frame, 
            text="🎯 Đang hiển thị trong Modal (4 slot):",
            style='Modal.TLabel',
            font=('Segoe UI', 10, 'bold')
        ).pack(anchor=tk.W)
        
        # Listbox sản phẩm featured
        featured_list_frame = ttk.Frame(left_frame)
        featured_list_frame.pack(fill=tk.BOTH, expand=True, pady=5)
        
        featured_scrollbar = ttk.Scrollbar(featured_list_frame)
        featured_scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
        
        self.featured_listbox = tk.Listbox(
            featured_list_frame,
            bg='#2a2a2a',
            fg='white',
            selectbackground='#e50914',
            font=('Segoe UI', 10),
            height=12,
            yscrollcommand=featured_scrollbar.set
        )
        self.featured_listbox.pack(fill=tk.BOTH, expand=True)
        featured_scrollbar.config(command=self.featured_listbox.yview)
        
        # Nút xóa khỏi modal
        remove_btn = tk.Button(
            left_frame,
            text="❌ Xóa khỏi Modal",
            bg='#dc3545',
            fg='white',
            font=('Segoe UI', 10, 'bold'),
            command=self.remove_from_featured
        )
        remove_btn.pack(fill=tk.X, pady=5)
        
        # Nút di chuyển lên/xuống trong featured
        move_featured_frame = ttk.Frame(left_frame)
        move_featured_frame.pack(fill=tk.X, pady=5)
        
        move_up_featured_btn = tk.Button(
            move_featured_frame,
            text="🔼 Lên",
            bg='#3b82f6',
            fg='white',
            font=('Segoe UI', 9, 'bold'),
            command=self.move_featured_up
        )
        move_up_featured_btn.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(0, 2))
        
        move_down_featured_btn = tk.Button(
            move_featured_frame,
            text="🔽 Xuống",
            bg='#3b82f6',
            fg='white',
            font=('Segoe UI', 9, 'bold'),
            command=self.move_featured_down
        )
        move_down_featured_btn.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(2, 0))
        
        # === Cột phải: Tất cả sản phẩm ===
        right_frame = ttk.Frame(columns_frame)
        right_frame.pack(side=tk.RIGHT, fill=tk.BOTH, expand=True, padx=(10, 0))
        
        ttk.Label(
            right_frame,
            text="📦 Tất cả sản phẩm:",
            style='Modal.TLabel',
            font=('Segoe UI', 10, 'bold')
        ).pack(anchor=tk.W)
        
        # Listbox tất cả sản phẩm
        all_list_frame = ttk.Frame(right_frame)
        all_list_frame.pack(fill=tk.BOTH, expand=True, pady=5)
        
        all_scrollbar = ttk.Scrollbar(all_list_frame)
        all_scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
        
        self.all_listbox = tk.Listbox(
            all_list_frame,
            bg='#2a2a2a',
            fg='white',
            selectbackground='#10b981',
            font=('Segoe UI', 10),
            height=12,
            yscrollcommand=all_scrollbar.set
        )
        self.all_listbox.pack(fill=tk.BOTH, expand=True)
        all_scrollbar.config(command=self.all_listbox.yview)
        
        # Nút thêm vào modal
        add_btn = tk.Button(
            right_frame,
            text="➕ Thêm vào Modal",
            bg='#10b981',
            fg='white',
            font=('Segoe UI', 10, 'bold'),
            command=self.add_to_featured
        )
        add_btn.pack(fill=tk.X, pady=5)
        
        # === Footer buttons ===
        footer_frame = ttk.Frame(main_frame)
        footer_frame.pack(fill=tk.X, pady=(15, 0))
        
        close_btn = tk.Button(
            footer_frame,
            text="Đóng",
            bg='#6c757d',
            fg='white',
            font=('Segoe UI', 10),
            command=self.window.destroy
        )
        close_btn.pack(side=tk.RIGHT)
        
        # Thông tin
        info_label = ttk.Label(
            footer_frame,
            text="💡 Thay đổi được lưu tự động",
            style='Modal.TLabel',
            foreground='#4ade80'
        )
        info_label.pack(side=tk.LEFT)
    
    def refresh_lists(self):
        """Cập nhật cả 2 danh sách"""
        # Cập nhật danh sách featured
        self.featured_listbox.delete(0, tk.END)
        for i, product in enumerate(self.featured):
            self.featured_listbox.insert(tk.END, f"Slot {i+1}: {product['name']}")
        
        # Thêm slot trống nếu chưa đủ 4
        for i in range(len(self.featured), 4):
            self.featured_listbox.insert(tk.END, f"Slot {i+1}: (Trống)")
        
        # Cập nhật danh sách tất cả sản phẩm
        self.all_listbox.delete(0, tk.END)
        featured_ids = [p.get('id') for p in self.featured]
        for product in self.products:
            status = " ✅" if product['id'] in featured_ids else ""
            self.all_listbox.insert(tk.END, f"{product['name']}{status}")
    
    def add_to_featured(self):
        """Thêm sản phẩm vào modal"""
        selection = self.all_listbox.curselection()
        if not selection:
            messagebox.showwarning("Cảnh báo", "Vui lòng chọn sản phẩm cần thêm!")
            return
        
        if len(self.featured) >= 4:
            messagebox.showwarning("Cảnh báo", "Modal đã đủ 4 sản phẩm!\nVui lòng xóa bớt trước khi thêm mới.")
            return
        
        index = selection[0]
        product = self.products[index]
        
        # Kiểm tra đã có trong featured chưa
        featured_ids = [p.get('id') for p in self.featured]
        if product['id'] in featured_ids:
            messagebox.showinfo("Thông báo", "Sản phẩm này đã có trong Modal!")
            return
        
        # Tạo object featured (chỉ lấy các trường cần thiết)
        featured_product = {
            "id": product['id'],
            "name": product['name'],
            "image": product['image'].replace('../', ''),  # Chuyển từ ../aff-data/ sang aff-data/
            "priceNow": product['priceNow'],
            "priceOriginal": product.get('priceOriginal', ''),
            "buyLink": product['buyLink']
        }
        
        self.featured.append(featured_product)
        save_featured(self.featured)
        self.refresh_lists()
        
        messagebox.showinfo("Thành công", f"Đã thêm '{product['name']}' vào Modal!")
    
    def remove_from_featured(self):
        """Xóa sản phẩm khỏi modal"""
        selection = self.featured_listbox.curselection()
        if not selection:
            messagebox.showwarning("Cảnh báo", "Vui lòng chọn sản phẩm cần xóa!")
            return
        
        index = selection[0]
        if index >= len(self.featured):
            messagebox.showinfo("Thông báo", "Slot này đang trống!")
            return
        
        product = self.featured[index]
        if messagebox.askyesno("Xác nhận", f"Xóa '{product['name']}' khỏi Modal?"):
            del self.featured[index]
            save_featured(self.featured)
            self.refresh_lists()
    
    def move_featured_up(self):
        """Di chuyển sản phẩm lên trong featured"""
        selection = self.featured_listbox.curselection()
        if not selection:
            messagebox.showwarning("Cảnh báo", "Vui lòng chọn sản phẩm cần di chuyển!")
            return
        
        index = selection[0]
        if index >= len(self.featured):
            messagebox.showinfo("Thông báo", "Slot này đang trống!")
            return
        
        if index == 0:
            messagebox.showinfo("Thông báo", "Sản phẩm đã ở vị trí đầu tiên!")
            return
        
        # Hoán đổi
        self.featured[index], self.featured[index - 1] = self.featured[index - 1], self.featured[index]
        save_featured(self.featured)
        self.refresh_lists()
        self.featured_listbox.selection_set(index - 1)
    
    def move_featured_down(self):
        """Di chuyển sản phẩm xuống trong featured"""
        selection = self.featured_listbox.curselection()
        if not selection:
            messagebox.showwarning("Cảnh báo", "Vui lòng chọn sản phẩm cần di chuyển!")
            return
        
        index = selection[0]
        if index >= len(self.featured):
            messagebox.showinfo("Thông báo", "Slot này đang trống!")
            return
        
        if index >= len(self.featured) - 1:
            messagebox.showinfo("Thông báo", "Sản phẩm đã ở vị trí cuối cùng!")
            return
        
        # Hoán đổi
        self.featured[index], self.featured[index + 1] = self.featured[index + 1], self.featured[index]
        save_featured(self.featured)
        self.refresh_lists()
        self.featured_listbox.selection_set(index + 1)

if __name__ == "__main__":
    root = tk.Tk()
    app = ProductManagerApp(root)
    root.mainloop()
