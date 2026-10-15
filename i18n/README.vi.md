[English](../README.md) · [العربية](README.ar.md) · [Español](README.es.md) · [Français](README.fr.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Tiếng Việt](README.vi.md) · [中文 (简体)](README.zh-Hans.md) · [中文（繁體）](README.zh-Hant.md) · [Deutsch](README.de.md) · [Русский](README.ru.md)

[![LazyingArt banner — apps and four buddies](https://lazying.art/media/brand/lazyingart-intro.gif)](https://lazying.art)

# LazyChess

*Xem nước đi trước khi thực hiện — trong Cờ vua, Cờ tướng và Shogi.*

[![Website](https://img.shields.io/badge/Website-LazyingArt-0EA5E9?style=flat-square)](https://lazying.art) [![App screenshot](https://img.shields.io/badge/Preview-App-1F6651?style=flat-square)](../docs/images/app.png) [![GitHub Sponsors](https://img.shields.io/badge/Sponsor-lachlanchen-EA4AAA?style=flat-square&logo=githubsponsors)](https://github.com/sponsors/lachlanchen)

LazyChess là xưởng học local-first cho Cờ vua quốc tế, Cờ tướng và Shogi. Người học xem xét các ý định hợp lệ, xem trước bàn cờ giả định bất biến, đọc các khía cạnh giảng dạy có nhãn nguồn rồi xác nhận rõ ràng trước khi luật tất định thay đổi ván đấu.

| Donate | PayPal | Stripe |
| --- | --- | --- |
| [![Donate](https://img.shields.io/badge/Donate-LazyingArt-0EA5E9?style=for-the-badge&logo=kofi&logoColor=white)](https://chat.lazying.art/donate) | [![PayPal](https://img.shields.io/badge/PayPal-RongzhouChen-00457C?style=for-the-badge&logo=paypal&logoColor=white)](https://paypal.me/RongzhouChen) | [![Stripe](https://img.shields.io/badge/Stripe-Donate-635BFF?style=for-the-badge&logo=stripe&logoColor=white)](https://buy.stripe.com/aFadR8gIaflgfQV6T4fw400) |

## Xem trước

![Xưởng học LazyChess](../docs/images/app.png)

Sơ đồ thế cờ đặc thù cho từng trò chơi tách biệt quyền kiểm soát ô và tiếp xúc quân chính xác, các đường đi đã tính và triển vọng đổi quân chỉ dựa trên tiếp xúc, kế hoạch được biên soạn và biến máy có giới hạn. Di chuột hoặc lấy tiêu điểm cho xem trước cùng bằng chứng mà không đi quân; chỉ xác nhận rõ ràng mới thay đổi ván đấu. Mười một ngôn ngữ trong ứng dụng có tính ngang hàng nghiêm ngặt về danh mục và biến; tiếng Ả Rập còn chuyển hướng tài liệu sang phải-qua-trái.

## Ba kênh luật

| Chế độ | Thẩm quyền tất định | Giới hạn hiện tại |
| --- | --- | --- |
| Cờ vua quốc tế | `chess.js` 1.4.0 | Luật chuẩn, chiếu, nhập thành, bắt tốt qua đường, phong cấp, chiếu hết và phát hiện hòa của thư viện |
| Cờ tướng | Bộ chuyển đổi TypeScript tự viết | Lõi giảng dạy gồm di chuyển, cản chân mã, ngòi pháo, sông, cung, tướng đối mặt, an toàn khi bị chiếu và thua khi hết nước; phán định lặp/đuổi quân được hoãn |
| Shogi | Bộ chuyển đổi TypeScript tự viết | Lõi giảng dạy gồm di chuyển, thả quân, quân trong tay, phong cấp, nifu, an toàn khi bị chiếu và thua khi hết nước; lặp lại, chiếu liên tục và chiếu hết bằng thả tốt được hoãn |

Bạn đồng hành giải thích nhưng không đi quân. Máy tùy chọn chỉ cung cấp bằng chứng có giới hạn và không bao giờ thay đổi trạng thái có thẩm quyền.

## Sơ đồ thế cờ và phân tích

- **Kiểm soát** hiển thị tấn công và phòng thủ theo đúng luật từng trò chơi, gồm ô tốt tấn công, ngòi pháo và cản chân mã trong Cờ tướng, cùng thả quân Shogi tách khỏi khả năng di chuyển hợp lệ.
- **An toàn** đánh dấu quân được bảo vệ, bị tấn công, không được bảo vệ, được cứu và mới bị lộ mà không giả vờ rằng chỉ cần tiếp xúc là đã chứng minh được một nước bắt quân.
- **Đường** vẽ hướng của quân trượt theo đặc thù từng biến thể, các đường mở, ngòi pháo và vùng phong cấp—không phải lớp mây biểu thị lãnh thổ kiểu cờ vây.
- **Vùng vua** so sánh các ô bị chiếu, các ô thù địch quanh vua và đích đi hợp lệ chính xác của vua, kể cả ràng buộc tướng đối mặt trong Cờ tướng.
- Bàn cờ mới đưa ra một gợi ý giảng dạy được ghi rõ là giả định. Xem trước khi di chuột, lấy tiêu điểm hoặc chạm sẽ so sánh trước và sau; nhấp chuột phải hoặc Escape để xóa; **Xác nhận** là thao tác duy nhất làm thay đổi trạng thái.
- Stockfish và Pikafish có thể bổ sung bằng chứng có giới hạn về điểm số và biến chính (PV) của máy chuyên dụng. Fairy-Stockfish được ghi rõ là phương án Shogi cổ điển dự phòng. Mỗi kênh máy nêu phía gốc làm góc nhìn, giới hạn tìm kiếm, độ sâu, số nút, thời gian, nguồn gốc mã nguồn/tệp nhị phân và thang điểm gốc của máy không thể so sánh giữa các biến thể trò chơi.

## Sơ đồ kho mã

| Đường dẫn | Mục đích |
| --- | --- |
| `src/domain/` | Luật tất định, đề xuất, khía cạnh giảng dạy và lưu trữ |
| `src/i18n/` | Mười một danh mục ứng dụng đầy đủ và kiểm thử ngang hàng |
| `references/engines.md` | Nguồn máy tùy chọn và hợp đồng cài đặt đã xác minh |
| `scripts/` | Kiểm tra an toàn, cài đặt và xác minh máy |
| `docs/images/app.png` | Ảnh chụp ứng dụng hiện tại |

## Bắt đầu nhanh

Cần Node.js `^20.19.0` hoặc `>=22.12.0`.

```bash
npm ci
npm run dev
```

Vite mặc định chỉ nghe loopback. Lựa chọn ngôn ngữ được lưu qua danh sách cho phép 11 giá trị rõ ràng; giá trị lạ an toàn trở về tiếng Anh.

## Hợp đồng giảng dạy tất định

- ID đề xuất gắn toàn bộ trạng thái, người hành động và hành động chuẩn.
- Bản xem trước dẫn xuất trạng thái bất biến và không ghi vào lưu trữ.
- Lựa chọn cũ, không rõ, sai người hoặc sau khi kết thúc đều bị từ chối an toàn.
- Nhận định chính xác, đã tính, biên soạn, máy, mô hình và ẩn dụ giữ nhãn nguồn riêng.
- Các nước đáp lại một nước ứng viên là mẫu có giới hạn của những đặc điểm buộc đối phương phải đáp, không phải biến máy hay dự đoán được trình bày như thể bắt buộc; triển vọng vật chất dùng thang giá trị quân được biên soạn và nêu rõ.
- Phân tích được gắn với toàn bộ token trạng thái và người hành động. Bằng chứng cũ từ máy hoặc ứng viên bị từ chối thay vì được vẽ lại trên một thế cờ mới hơn.
- Giới hạn của Cờ tướng và Shogi luôn hiển thị thay vì được trình bày như phán định đầy đủ.

## Xác minh

```bash
npm run check
git diff --check
```

Bộ kiểm thử bao phủ luật tiêu biểu, phân tích Shogi có độ phân nhánh cao, ứng viên gắn trạng thái, xem trước bất biến, bằng chứng bắt tốt qua đường/pháo/tướng đối mặt/thả quân, tính lũy đẳng, tranh chấp lưu trữ, tiếp tục phiên, giao thức máy có giới hạn và an toàn đường dẫn, ngang hàng 11 ngôn ngữ, lưu ngôn ngữ, hướng RTL và xác nhận rõ ràng.

## Trích dẫn

Nếu dùng LazyChess trong nghiên cứu, hãy trích dẫn kho mã. GitHub đọc [CITATION.cff](../CITATION.cff) và hiển thị bảng **Cite this repository** trên trang dự án.

```bibtex
@software{chen_three_boards_teacher_2026,
  author  = {Chen, Lachlan},
  title   = {Three Boards Teacher: International Chess, Xiangqi, and Shogi},
  year    = {2026},
  version = {0.1.0},
  url     = {https://github.com/lachlanchen/LazyChess}
}
```

## Trạng thái và giấy phép

Ứng dụng giảng dạy là local-first và dùng giấy phép MIT. `chess.js` dùng BSD-2-Clause. Stockfish, Pikafish và Fairy-Stockfish vẫn là chương trình GPL-3.0 cài riêng và không được đóng gói kèm.
