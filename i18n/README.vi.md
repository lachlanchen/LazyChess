[English](../README.md) · [العربية](README.ar.md) · [Español](README.es.md) · [Français](README.fr.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Tiếng Việt](README.vi.md) · [中文 (简体)](README.zh-Hans.md) · [中文（繁體）](README.zh-Hant.md) · [Deutsch](README.de.md) · [Русский](README.ru.md)

[![LazyingArt banner](https://github.com/lachlanchen/lachlanchen/raw/main/figs/banner.png)](https://github.com/lachlanchen/lachlanchen/blob/main/figs/banner.png)

# LazyChess

*Xem nước đi trước khi thực hiện — trong Cờ vua, Cờ tướng và Shogi.*

[![Website](https://img.shields.io/badge/Website-LazyingArt-0EA5E9?style=flat-square)](https://lazying.art) [![App screenshot](https://img.shields.io/badge/Preview-App-1F6651?style=flat-square)](../docs/images/app.png) [![GitHub Sponsors](https://img.shields.io/badge/Sponsor-lachlanchen-EA4AAA?style=flat-square&logo=githubsponsors)](https://github.com/sponsors/lachlanchen)

LazyChess là xưởng học local-first cho Cờ vua quốc tế, Cờ tướng và Shogi. Người học xem xét các ý định hợp lệ, xem trước bàn cờ giả định bất biến, đọc các khía cạnh giảng dạy có nhãn nguồn rồi xác nhận rõ ràng trước khi luật tất định thay đổi ván đấu.

| Donate | PayPal | Stripe |
| --- | --- | --- |
| [![Donate](https://img.shields.io/badge/Donate-LazyingArt-0EA5E9?style=for-the-badge&logo=kofi&logoColor=white)](https://chat.lazying.art/donate) | [![PayPal](https://img.shields.io/badge/PayPal-RongzhouChen-00457C?style=for-the-badge&logo=paypal&logoColor=white)](https://paypal.me/RongzhouChen) | [![Stripe](https://img.shields.io/badge/Stripe-Donate-635BFF?style=for-the-badge&logo=stripe&logoColor=white)](https://buy.stripe.com/aFadR8gIaflgfQV6T4fw400) |

## Xem trước

![Xưởng học LazyChess](../docs/images/app.png)

Giao diện tách biệt rõ bằng chứng chính xác, đã tính, biên soạn, từ máy, từ mô hình và ẩn dụ. Mười một ngôn ngữ trong ứng dụng có tính ngang hàng nghiêm ngặt về danh mục và biến; tiếng Ả Rập còn chuyển hướng tài liệu sang phải-qua-trái.

## Ba kênh luật

| Chế độ | Thẩm quyền tất định | Giới hạn hiện tại |
| --- | --- | --- |
| Cờ vua quốc tế | `chess.js` 1.4.0 | Luật chuẩn, chiếu, nhập thành, bắt tốt qua đường, phong cấp, chiếu hết và phát hiện hòa của thư viện |
| Cờ tướng | Bộ chuyển đổi TypeScript tự viết | Lõi giảng dạy gồm di chuyển, cản chân mã, ngòi pháo, sông, cung, tướng đối mặt, an toàn khi bị chiếu và thua khi hết nước; phán định lặp/đuổi quân được hoãn |
| Shogi | Bộ chuyển đổi TypeScript tự viết | Lõi giảng dạy gồm di chuyển, thả quân, quân trong tay, phong cấp, nifu, an toàn khi bị chiếu và thua khi hết nước; lặp lại, chiếu liên tục và chiếu hết bằng thả tốt được hoãn |

Bạn đồng hành giải thích nhưng không đi quân. Máy tùy chọn chỉ cung cấp bằng chứng có giới hạn và không bao giờ thay đổi trạng thái có thẩm quyền.

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
- Giới hạn của Cờ tướng và Shogi luôn hiển thị thay vì được trình bày như phán định đầy đủ.

## Xác minh

```bash
npm run check
git diff --check
```

Bộ kiểm thử bao phủ luật tiêu biểu, đề xuất gắn trạng thái, tính lũy đẳng, xem trước bất biến, tranh chấp lưu trữ, tiếp tục phiên, an toàn đường dẫn máy, ngang hàng 11 ngôn ngữ, lưu ngôn ngữ, hướng RTL và xác nhận rõ ràng.

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
