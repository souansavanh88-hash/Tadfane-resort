import { useState, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useHotel } from '../context/HotelContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from './ToastProvider';
import {
  ROOM_TYPES, formatCurrency, daysBetween, todayStr, addDays
} from '../data/initialData';
import SignaturePadModal from './SignaturePadModal';
import PrintReceipt from './PrintReceipt';
import ShareBookingModal from './ShareBookingModal';

const ROOM_TYPES_LABEL = {
  standard: { lo: 'Standard', en: 'Standard Room', th: 'ห้อง Standard', vi: 'Phòng Standard' },
  superior: { lo: 'Superior', en: 'Superior Room', th: 'ห้อง Superior', vi: 'Phòng Superior' },
  deluxe: { lo: 'Deluxe', en: 'Deluxe Room', th: 'ห้อง Deluxe', vi: 'Phòng Deluxe' },
  suite: { lo: 'Suite', en: 'Suite Room', th: 'ห้อง Suite', vi: 'Phòng Suite' },
  family: { lo: 'Family', en: 'Family Room', th: 'ห้อง Family', vi: 'Phòng Family' },
};

const FORM_TEXT = {
  lo: {
    formTitle: 'ໃບລົງທະບຽນຮັບຫ້ອງພັກ',
    secBooking: 'ຂໍ້ມູນການຈອງຫ້ອງ',
    secGuest: 'ຂໍ້ມູນລູກຄ້າ',
    secPayment: 'ຮູບແບບການຊຳລະເງິນ',
    secTerms: 'ກະລຸນາຊາບ / ຂໍ້ກຳນົດຂອງຣີສອດ:',
    titlePrefix: 'ຄຳນຳໜ້າ',
    lastName: 'ນາມສະກຸນ',
    firstName: 'ຊື່',
    bookingNo: 'ລະຫັດການຈອງ',
    roomNo: 'ເບີຫ້ອງ',
    roomType: 'ປະເພດຫ້ອງ',
    checkInDate: 'ວັນເຂົ້າພັກ',
    guestCount: 'ຈຳນວນແຂກ',
    roomRate: 'ລາຄາຫ້ອງ/ຄືນ',
    checkOutDate: 'ວັນອອກ',
    nights: 'ຈຳນວນຄືນ',
    flight: 'ຖ້ຽວບິນ / ພາຫະນະ',
    bookedVia: 'ຈອງຜ່ານ / ບໍລິສັດ',
    prevStays: 'ຄັ້ງທີເຄີຍພັກ',
    notes: 'ໝາຍເຫດ',
    address: 'ທີ່ຢູ່',
    city: 'ເມືອງ',
    province: 'ແຂວງ',
    email: 'ອີເມວ',
    phone: 'ເບີໂທ',
    country: 'ປະເທດ / ສັນຊາດ',
    dob: 'ວັນເດືອນປີເກີດ',
    idNo: 'ເລກບັດປະຈຳຕົວ / ພາສປອດ',
    payCash: 'ເງິນສົດ',
    payTransfer: 'ໂອນເງິນ',
    payQr: 'QR Code',
    payCard: 'ບັດ (Visa / Master / JCB / UnionPay)',
    payCompany: 'ບໍລິສັດ',
    noInvoice: 'ບໍ່ຕ້ອງການໃບບິນ',
    cardNo: 'ເລກບັດ (4 ໂຕທ້າຍ)',
    cardExp: 'ວັນໝົດອາຍຸ',
    balanceSummary: 'ສະຫຼຸບຍອດຊຳລະ',
    adultsShort: 'ຜູ້ໃຫຍ່ (A)',
    childrenShort: 'ເດັກ (C)',
    agreeText: (hotelName) =>
      `ໂດຍການເຊັນຊື່ໃນໃບລົງທະບຽນນີ້, ຂ້າພະເຈົ້າຂໍຢືນຢັນວ່າໄດ້ອ່ານ, ເຂົ້າໃຈ ແລະ ຍອມຮັບປະຕິບັດຕາມນະໂຍບາຍ, ກົດລະບຽບ ແລະ ຂໍ້ກຳນົດທັງໝົດຂອງ ${hotelName}. ຂ້າພະເຈົ້າຍິນຍອມໃຫ້ທາງຣີສອດເກັບຄ່າບໍລິການເພີ່ມເຕີມ ຫຼື ຄ່າເສຍຫາຍ (ຖ້າມີ) ກ່ອນອອກຈາກຣີສອດ.`,
    guestSigLabel: 'ລາຍເຊັນລູກຄ້າ / Guest Signature',
    staffSigLabel: 'ພະນັກງານຕ້ອນຮັບ / Receptionist',
    signedAtLabel: 'ເຊັນເມື່ອ',
    notSignedYet: 'ຍັງບໍ່ໄດ້ເຊັນຊື່ (ກົດປຸ່ມ Signature ດ້ານຂວາລຸ່ມ)',
    btnSignature: 'Signature',
    btnEditSignature: 'ແກ້ໄຂລາຍເຊັນ',
    rules: (inTime, outTime) => [
      `ເວລາເຂົ້າພັກ (Check-in) ຕັ້ງແຕ່ ${inTime} ໂມງ ແລະ ເວລາອອກ (Check-out) ກ່ອນ ${outTime} ໂມງທ່ຽງ. ການເຂົ້າກ່ອນ ຫຼື ອອກຊ້າຂຶ້ນກັບສະພາບຫ້ອງວ່າງ ແລະ ອາດມີຄ່າບໍລິການເພີ່ມ.`,
      'ເມື່ອເຮັດຂັ້ນຕອນຮັບຫ້ອງ, ກະລຸນາສະແດງພາສປອດ, ບັດປະຈຳຕົວ ຫຼື ເອກະສານຢັ້ງຢືນຕົວຕົນທີ່ຖືກຕ້ອງຕາມກົດໝາຍ.',
      'ລູກຄ້າຍິນຍອມວາງເງິນມັດຈຳ (ຖ້າມີ) ເພື່ອຮັບປະກັນຄ່າໃຊ້ຈ່າຍເພີ່ມເຕີມລະຫວ່າງພັກເຊົາ; ເງິນມັດຈຳທີ່ເຫຼືອຈະຄືນໃຫ້ເມື່ອ Check-out.',
      'ເພື່ອຄວາມປອດໄພ, ກະລຸນາດູແລເດັກນ້ອຍຢ່າງໃກ້ຊິດໂດຍສະເພາະບໍລິເວນລະບຽງ, ຂັ້ນໄດ ແລະ ພື້ນທີ່ທຳມະຊາດອ້ອມຂ້າງ.',
      'ແຂກທີ່ມາຢ້ຽມຢາມຕ້ອງລົງທະບຽນຢູ່ເຄົາເຕີ້ຕ້ອນຮັບ ແລະ ສະແດງບັດປະຈຳຕົວ (ເວລາຢ້ຽມ 08:00–21:00). ຫ້າມຄ້າງຄືນໂດຍບໍ່ໄດ້ແຈ້ງ.',
      'ກະລຸນາຮັກສາຄວາມງຽບສະຫງົບ ແລະ ຫຼຸດສຽງລົບກວນແຂກຫ້ອງອື່ນ ໃນຊ່ວງເວລາ 22:00 ຫາ 07:00 ໂມງ.',
      'ເງິນສົດ, ເຄື່ອງປະດັບ ແລະ ຊັບສິນມີຄ່າກະລຸນາເກັບຮັກສາໃນຕູ້ນິລະໄພ ຫຼື ນຳຕິດຕົວ. ຣີສອດບໍ່ຮັບຜິດຊອບກໍລະນີສູນຫາຍ.',
      'ຫ້າມສູບຢາ (ລວມທັງຢາສູບໄຟຟ້າ), ຫ້າມຈູດທູບທຽນ ແລະ ຫ້າມນຳອາຫານກິ່ນແຮງ (ເຊັ່ນ: ຖົ່ວລຽນ, ປາແດກ) ເຂົ້າຫ້ອງພັກ. ຖ້າລະເມີດຈະມີຄ່າທຳຄວາມສະອາດ 500,000 ₭.',
      'ຫ້າມນຳວັດຖຸໄວໄຟ ຫຼື ສິ່ງຜິດກົດໝາຍເຂົ້າໃນຣີສອດຢ່າງເດັດຂາດ. ທຸກການເສຍຫາຍຂອງອຸປະກອນໃນຫ້ອງຈະຖືກຄິດຄ່າຊົດເຊີຍຕາມຄວາມເປັນຈິງ.',
      'ກະລຸນາສົ່ງຄືນກະແຈ/ຄີກາດຫ້ອງທີ່ເຄົາເຕີ້ຕອນ Check-out (ກໍລະນີເຮັດເສຍຈະມີຄ່າປັບໃໝ 100,000 ₭/ອັນ).',
    ],
  },
  en: {
    formTitle: 'RESORT CHECK-IN REGISTRATION FORM',
    secBooking: 'Booking Information',
    secGuest: 'Guest Information',
    secPayment: 'Method of Payment',
    secTerms: 'Please Note / Terms & Conditions:',
    titlePrefix: 'Title',
    lastName: 'Last Name',
    firstName: 'First Name',
    bookingNo: 'Booking No.',
    roomNo: 'Room No.',
    roomType: 'Room Type',
    checkInDate: 'Arrival Date',
    guestCount: 'Guests',
    roomRate: 'Room Rate',
    checkOutDate: 'Departure Date',
    nights: 'Nights',
    flight: 'Flight / Vehicle',
    bookedVia: 'Company / Channel',
    prevStays: 'Previous Stays',
    notes: 'Remarks',
    address: 'Address',
    city: 'City',
    province: 'Province / State',
    email: 'Email',
    phone: 'Telephone',
    country: 'Country / Nationality',
    dob: 'Date of Birth',
    idNo: 'Passport / ID No.',
    payCash: 'Cash',
    payTransfer: 'Bank Transfer',
    payQr: 'QR Code',
    payCard: 'Credit / Debit Card',
    payCompany: 'Company Account',
    noInvoice: 'No Invoice Required',
    cardNo: 'Card No. (Last 4)',
    cardExp: 'Expiry Date',
    balanceSummary: 'Payment Summary',
    adultsShort: 'Adults (A)',
    childrenShort: 'Child (C)',
    agreeText: (hotelName) =>
      `By signing this registration card, I confirm that I have read, understood, and agreed to comply with all policies, rules, and regulations of ${hotelName}. I agree to settle all room charges and any incidental expenses incurred prior to departure.`,
    guestSigLabel: 'Guest Signature',
    staffSigLabel: 'Receptionist',
    signedAtLabel: 'Signed at',
    notSignedYet: 'Not signed yet (Tap Signature button at bottom right)',
    btnSignature: 'Signature',
    btnEditSignature: 'Edit Signature',
    rules: (inTime, outTime) => [
      `Check-in time is from ${inTime} and check-out time is before ${outTime} noon. Early check-in or late check-out is subject to room availability and extra charges.`,
      'Guests are required to present a valid Passport, National ID card, or legal identification upon check-in.',
      'A security deposit or payment guarantee may be required upon check-in for incidental charges; unused deposit will be refunded upon check-out.',
      'For safety, parents/guardians must supervise children at all times, especially near balconies, stairs, and resort grounds.',
      'All visitors must register at the reception desk with valid ID (visiting hours 08:00–21:00). Unregistered overnight guests will incur extra charges.',
      'Please maintain quiet hours from 22:00 to 07:00 out of respect for fellow guests.',
      'Please secure cash, jewelry, and valuables; the resort is not responsible for unattended personal belongings.',
      'Non-smoking policy (including e-cigarettes), no candles/incense, and no strong-odour items (e.g. durian) inside rooms. A 500,000 ₭ deep-cleaning fee applies for violations.',
      'Flammable, hazardous, or illegal items are strictly prohibited. Guests are liable for any damage or loss of resort property.',
      'Room key / key card must be returned upon check-out (lost key replacement fee: 100,000 ₭).',
    ],
  },
  th: {
    formTitle: 'แบบฟอร์มลงทะเบียนเข้าพัก (Check-in)',
    secBooking: 'ข้อมูลการจองห้องพัก',
    secGuest: 'ข้อมูลผู้เข้าพัก',
    secPayment: 'รูปแบบการชำระเงิน',
    secTerms: 'ข้อกำหนดและเงื่อนไขการเข้าพัก:',
    titlePrefix: 'คำนำหน้า',
    lastName: 'นามสกุล',
    firstName: 'ชื่อ',
    bookingNo: 'หมายเลขการจอง',
    roomNo: 'หมายเลขห้อง',
    roomType: 'ประเภทห้อง',
    checkInDate: 'วันที่เข้าพัก',
    guestCount: 'จำนวนผู้เข้าพัก',
    roomRate: 'ราคาห้อง/คืน',
    checkOutDate: 'วันที่เช็คเอาท์',
    nights: 'จำนวนคืน',
    flight: 'เที่ยวบิน / ยานพาหนะ',
    bookedVia: 'บริษัท / ช่องทางจอง',
    prevStays: 'จำนวนครั้งที่เข้าพัก',
    notes: 'หมายเหตุ',
    address: 'ที่อยู่',
    city: 'อำเภอ/เขต',
    province: 'จังหวัด',
    email: 'อีเมล',
    phone: 'เบอร์โทรศัพท์',
    country: 'ประเทศ / สัญชาติ',
    dob: 'วันเดือนปีเกิด',
    idNo: 'เลขบัตรประชาชน / พาสปอร์ต',
    payCash: 'เงินสด',
    payTransfer: 'โอนเงิน',
    payQr: 'QR Code',
    payCard: 'บัตรเครดิต / เดบิต',
    payCompany: 'บริษัท',
    noInvoice: 'ไม่รับใบกำกับ/ใบเสร็จ',
    cardNo: 'เลขบัตร (4 หลักท้าย)',
    cardExp: 'วันหมดอายุ',
    balanceSummary: 'สรุปยอดชำระ',
    adultsShort: 'ผู้ใหญ่ (A)',
    childrenShort: 'เด็ก (C)',
    agreeText: (hotelName) =>
      `การลงนามในแบบฟอร์มนี้ ข้าพเจ้ายืนยันว่าได้อ่าน เข้าใจ และตกลงปฏิบัติตามกฎระเบียบและนโยบายของ ${hotelName} และยินยอมชำระค่าห้องพักรวมถึงค่าใช้จ่ายเพิ่มเติม (หากมี) ก่อนเช็คเอาท์`,
    guestSigLabel: 'ลายเซ็นผู้เข้าพัก / Signature',
    staffSigLabel: 'พนักงานต้อนรับ / Receptionist',
    signedAtLabel: 'ลงนามเมื่อ',
    notSignedYet: 'ยังไม่ได้ลงนาม (กดปุ่ม Signature ด้านขวาล่าง)',
    btnSignature: 'Signature',
    btnEditSignature: 'แก้ไขลายเซ็น',
    rules: (inTime, outTime) => [
      `เวลาเช็คอินตั้งแต่ ${inTime} น. และเวลาเช็คเอาท์ก่อน ${outTime} น. การเช็คอินก่อนเวลาหรือเช็คเอาท์ล่าช้าขึ้นอยู่กับห้องว่างและอาจมีค่าบริการเพิ่มเติม`,
      'กรุณาแสดงหนังสือเดินทาง (Passport) หรือบัตรประชาชนที่ยังไม่หมดอายุเมื่อทำการเช็คอิน',
      'ทางรีสอร์ทอาจขอเก็บเงินมัดจำเพื่อรับประกันค่าใช้จ่ายระหว่างการเข้าพัก และจะคืนให้เต็มจำนวนเมื่อเช็คเอาท์หากไม่มีค่าใช้จ่ายค้างชำระ',
      'เพื่อความปลอดภัย กรุณาดูแลเด็กอย่างใกล้ชิดโดยเฉพาะบริเวณระเบียง บันได และพื้นที่โดยรอบรีสอร์ท',
      'ผู้มาติดต่อต้องลงทะเบียนที่เคาน์เตอร์ต้อนรับ (เวลาเยี่ยม 08:00–21:00 น.) ห้ามผู้ไม่ได้ลงทะเบียนพักค้างคืน',
      'กรุณางดใช้เสียงดังรบกวนผู้เข้าพักท่านอื่นในช่วงเวลา 22:00 – 07:00 น.',
      'กรุณาเก็บรักษาทรัพย์สินมีค่าด้วยตนเอง ทางรีสอร์ทไม่รับผิดชอบต่อการสูญหายภายในห้องพัก',
      'ห้ามสูบบุหรี่ (รวมถึงบุหรี่ไฟฟ้า) และห้ามนำอาหารที่มีกลิ่นแรง (เช่น ทุเรียน) เข้าในห้องพัก หากฝ่าฝืนมีค่าทำความสะอาด 500,000 ₭',
      'ห้ามนำวัตถุไวไฟหรือสิ่งผิดกฎหมายเข้ามาในรีสอร์ท ความเสียหายของทรัพย์สินรีสอร์ทจะคิดค่าชดเชยตามจริง',
      'กรุณาคืนกุญแจ / คีย์การ์ดเมื่อเช็คเอาท์ (กรณีสูญหายมีค่าปรับ 100,000 ₭/ใบ)',
    ],
  },
  vi: {
    formTitle: 'PHIẾU ĐĂNG KÝ NHẬN PHÒNG',
    secBooking: 'Thông tin đặt phòng',
    secGuest: 'Thông tin khách hàng',
    secPayment: 'Hình thức thanh toán',
    secTerms: 'Xin vui lòng lưu ý:',
    titlePrefix: 'Quý danh',
    lastName: 'Họ',
    firstName: 'Tên',
    bookingNo: 'Số đặt phòng',
    roomNo: 'Số phòng',
    roomType: 'Loại phòng',
    checkInDate: 'Ngày nhận phòng',
    guestCount: 'Số lượng khách',
    roomRate: 'Giá phòng',
    checkOutDate: 'Ngày trả phòng',
    nights: 'Số đêm lưu trú',
    flight: 'Chuyến bay / Phương tiện',
    bookedVia: 'Đặt qua công ty / Kênh',
    prevStays: 'Số lần đã lưu trú',
    notes: 'Ghi chú',
    address: 'Địa chỉ',
    city: 'Thành phố',
    province: 'Tỉnh',
    email: 'Email',
    phone: 'Số điện thoại',
    country: 'Quốc gia',
    dob: 'Ngày sinh',
    idNo: 'Số CCCD / Hộ chiếu',
    payCash: 'Tiền mặt',
    payTransfer: 'Chuyển khoản',
    payQr: 'QR Code',
    payCard: 'Thẻ tín dụng / ghi nợ',
    payCompany: 'Công ty',
    noInvoice: 'Khách không lấy hoá đơn',
    cardNo: 'Số thẻ (4 số cuối)',
    cardExp: 'Ngày hết hạn',
    balanceSummary: 'Tổng hợp thanh toán',
    adultsShort: 'Người lớn (A)',
    childrenShort: 'Trẻ em (C)',
    agreeText: (hotelName) =>
      `Bằng việc ký vào phiếu đăng ký lưu trú này, tôi xác nhận rằng tôi đã đọc, hiểu và đồng ý tuân thủ toàn bộ các chính sách, nội quy và quy định của ${hotelName}. Tôi đồng ý thanh toán đầy đủ các chi phí phát sinh trước khi rời khu nghỉ dưỡng.`,
    guestSigLabel: 'Chữ ký khách / Guest Signature',
    staffSigLabel: 'Lễ tân / Receptionist',
    signedAtLabel: 'Đã ký lúc',
    notSignedYet: 'Chưa ký tên (Nhấn nút Signature ở góc dưới bên phải)',
    btnSignature: 'Signature',
    btnEditSignature: 'Sửa chữ ký',
    rules: (inTime, outTime) => [
      `Giờ nhận phòng từ ${inTime} và giờ trả phòng trước ${outTime} trưa. Nhận phòng sớm hoặc trả phòng trễ tùy thuộc tình trạng phòng và có thể áp dụng phụ thu.`,
      'Khi làm thủ tục nhận phòng, Quý khách vui lòng xuất trình Hộ chiếu, Căn cước công dân hoặc giấy tờ hợp pháp theo quy định.',
      'Quý khách đồng ý đặt cọc (nếu có) nhằm đảm bảo các chi phí phát sinh trong thời gian lưu trú; khoản đặt cọc chưa sử dụng sẽ được hoàn trả khi trả phòng.',
      'Vì lý do an toàn, Quý khách vui lòng cẩn trọng, đặc biệt đối với trẻ em tại khu vực ban công, cầu thang và khuôn viên khu nghỉ dưỡng.',
      'Khách đến thăm phải đăng ký tại Lễ tân và xuất trình giấy tờ tùy thân (từ 08:00 đến 21:00). Khách ở qua đêm chưa đăng ký sẽ tính phụ thu.',
      'Quý khách vui lòng giữ yên tĩnh, hạn chế tiếng ồn cho các phòng khác từ 22:00 đến 07:00.',
      'Tiền mặt, trang sức và tài sản có giá trị cần được cất giữ cẩn thận; khu nghỉ dưỡng không chịu trách nhiệm nếu để mất mát.',
      'Khu nghỉ dưỡng áp dụng chính sách không hút thuốc (kể cả thuốc lá điện tử) và không mang thực phẩm có mùi mạnh (sầu riêng...) vào phòng. Phí xử lý mùi là 500.000 ₭.',
      'Nghiêm cấm sử dụng vật liệu dễ cháy nổ hoặc chất cấm. Mọi hư hỏng, mất mát trang thiết bị trong phòng sẽ bồi thường theo quy định.',
      'Vui lòng trả lại chìa khoá / thẻ phòng khi trả phòng (phí cấp lại thẻ thất lạc: 100.000 ₭/thẻ).',
    ],
  },
};

function splitGuestName(fullName = '') {
  const clean = (fullName || '').trim();
  if (!clean) return { firstName: '', lastName: '' };
  const parts = clean.split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' '),
  };
}

function compressImageFile(file, maxSize = 900, quality = 0.7) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxSize || height > maxSize) {
          const ratio = Math.min(maxSize / width, maxSize / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function CheckInRegistrationModal({
  booking = null,
  room = null,
  initialPayAmount,
  initialPayMethod,
  onClose,
  onBack,
  onCompleted,
}) {
  const {
    rooms, bookings, hotelInfo, lang,
    checkIn, updateBooking, createBooking, isRoomAvailableForDates, quoteStay
  } = useHotel();
  const { currentUser } = useAuth();
  const { toast } = useToast();

  const isWalkInNew = !booking;
  const today = todayStr();
  const initialSplit = splitGuestName(booking?.guestName || '');

  const [formLang, setFormLang] = useState(() => (lang === 'en' ? 'en' : lang === 'th' ? 'th' : lang === 'vi' ? 'vi' : 'bi'));
  const [guestHandoffMode, setGuestHandoffMode] = useState(false);
  const [hideRoomRate, setHideRoomRate] = useState(false);
  const [showSigPad, setShowSigPad] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showIdPreview, setShowIdPreview] = useState(false);
  const [receiptState, setReceiptState] = useState(null);
  const fileInputRef = useRef(null);

  const defaultRoomId = booking?.roomId || room?.id || rooms.find(r => isRoomAvailableForDates(r.id, today, addDays(today, 1)))?.id || '';

  const [form, setForm] = useState(() => {
    const pax = Number(booking?.guestCount || 1);
    return {
      roomId: defaultRoomId,
      checkIn: booking?.checkIn || today,
      checkOut: booking?.checkOut || addDays(today, 1),
      guestTitle: booking?.guestTitle || '',
      firstName: booking?.firstName || initialSplit.firstName,
      lastName: booking?.lastName || initialSplit.lastName,
      adults: booking?.adults ?? pax,
      children: booking?.children ?? 0,
      flightInfo: booking?.flightInfo || '',
      company: booking?.company || (booking?.bookingChannel && booking.bookingChannel !== 'walkin' ? booking.bookingChannel : ''),
      previousStays: booking?.previousStays ?? '',
      notes: booking?.notes || '',
      address: booking?.address || '',
      city: booking?.city || '',
      province: booking?.province || '',
      email: booking?.email || '',
      guestPhone: booking?.guestPhone || '',
      guestNationality: booking?.guestNationality || 'ລາວ',
      dob: booking?.dob || '',
      passportNo: booking?.passportNo || '',
      regPayMethod: booking?.regPayMethod || initialPayMethod || booking?.remainingPaymentMethod || booking?.paymentMethod || 'cash',
      noInvoice: Boolean(booking?.noInvoice),
      cardLast4: booking?.cardLast4 || '',
      cardExp: booking?.cardExp || '',
      signatureDataUrl: booking?.signatureDataUrl || '',
      signedAt: booking?.signedAt || '',
      idPhotoDataUrl: booking?.idPhotoDataUrl || '',
    };
  });

  const activeRoom = rooms.find(r => r.id === form.roomId) || room;

  const quote = useMemo(() => {
    if (!activeRoom || !form.checkIn || !form.checkOut || form.checkIn >= form.checkOut) {
      return { nights: 1, total: (activeRoom?.price || 0), hasAdjustment: false, nightly: [] };
    }
    return quoteStay ? quoteStay(activeRoom, form.checkIn, form.checkOut) : { nights: 1, total: (activeRoom.price || 0), hasAdjustment: false, nightly: [] };
  }, [activeRoom, form.checkIn, form.checkOut, quoteStay]);

  const nights = form.checkIn && form.checkOut && form.checkOut > form.checkIn
    ? quote.nights
    : (booking?.nights || 1);

  const groupRooms = booking?.groupRooms?.length > 1 ? booking.groupRooms : null;
  const roomNumbersDisplay = groupRooms
    ? `${groupRooms.map(g => g.number).join(', ')} (${groupRooms.length} ຫ້ອງ)`
    : (activeRoom?.number || booking?.roomId || '-');

  const unitPrice = groupRooms
    ? groupRooms.reduce((s, g) => s + Number(g.price || 0), 0)
    : (booking?.roomPrice ?? activeRoom?.price ?? 0);
  const computedTotal = groupRooms
    ? Number(booking?.groupTotalAmount ?? (unitPrice * nights))
    : (booking ? Number(booking.totalAmount || 0) : quote.total);

  const depositPaid = groupRooms && booking?.groupPaidAmount !== undefined
    ? Number(booking.groupPaidAmount)
    : Number(booking?.deposit || 0);
  const priorRemainingPaid = Number(booking?.remainingPaid || 0);
  const defaultCollectNow = isWalkInNew
    ? computedTotal
    : (initialPayAmount !== undefined
      ? Number(initialPayAmount)
      : Number((groupRooms ? booking?.groupRemainingAmount : booking?.remainingAmount) || 0));

  const [collectAmount, setCollectAmount] = useState(defaultCollectNow);

  const autoPreviousStays = useMemo(() => {
    if (form.previousStays !== '' && form.previousStays !== null && form.previousStays !== undefined) {
      return form.previousStays;
    }
    const phoneClean = (form.guestPhone || '').replace(/\s+/g, '');
    const passportClean = (form.passportNo || '').trim().toLowerCase();
    const fullNameClean = `${form.firstName} ${form.lastName}`.trim().toLowerCase();
    if (!phoneClean && !passportClean && !fullNameClean) return 1;
    const matched = bookings.filter(b => {
      if (booking && (b.id === booking.id || (booking.groupId && b.groupId === booking.groupId))) return false;
      if (b.status === 'cancelled' || b.status === 'no_show') return false;
      if (passportClean && (b.passportNo || '').trim().toLowerCase() === passportClean) return true;
      if (phoneClean && phoneClean !== '-' && (b.guestPhone || '').replace(/\s+/g, '') === phoneClean) return true;
      if (fullNameClean && (b.guestName || '').trim().toLowerCase() === fullNameClean) return true;
      return false;
    }).length;
    return matched + 1;
  }, [bookings, booking, form.previousStays, form.guestPhone, form.passportNo, form.firstName, form.lastName]);

  const set = (key, val) => setForm(p => {
    const next = { ...p, [key]: val };
    if (key === 'checkIn' && val && next.checkOut <= val) {
      next.checkOut = addDays(val, 1);
    }
    return next;
  });

  const baseLang = formLang === 'bi' ? 'lo' : formLang;
  const T = FORM_TEXT[baseLang] || FORM_TEXT.lo;
  const TEN = FORM_TEXT.en;
  const biLabel = (key) => (formLang === 'bi' ? `${FORM_TEXT.lo[key]} / ${TEN[key]}` : T[key]);

  const roomTypeText = groupRooms
    ? [...new Set(groupRooms.map(g => ROOM_TYPES_LABEL[g.type]?.en || g.type))].join(', ')
    : activeRoom
      ? (formLang === 'bi'
        ? `${ROOM_TYPES[activeRoom.type] || activeRoom.type} / ${ROOM_TYPES_LABEL[activeRoom.type]?.en || activeRoom.type}`
        : (ROOM_TYPES_LABEL[activeRoom.type]?.[baseLang] || ROOM_TYPES[activeRoom.type] || activeRoom.type))
      : '-';

  const rulesList = formLang === 'bi'
    ? FORM_TEXT.lo.rules(hotelInfo?.checkInTime || '14:00', hotelInfo?.checkOutTime || '12:00').map((loRule, idx) => ({
      lo: loRule,
      en: TEN.rules(hotelInfo?.checkInTime || '14:00', hotelInfo?.checkOutTime || '12:00')[idx],
    }))
    : T.rules(hotelInfo?.checkInTime || '14:00', hotelInfo?.checkOutTime || '12:00').map(r => ({ main: r }));

  const composedFullName = [form.firstName, form.lastName].filter(Boolean).join(' ').trim() || booking?.guestName || '';

  const buildRegistrationPatch = () => ({
    guestName: composedFullName || 'Guest',
    guestTitle: form.guestTitle,
    firstName: form.firstName.trim(),
    lastName: form.lastName.trim(),
    adults: Number(form.adults) || 1,
    children: Number(form.children) || 0,
    guestCount: Math.max(1, (Number(form.adults) || 1) + (Number(form.children) || 0)),
    flightInfo: form.flightInfo.trim(),
    company: form.company.trim(),
    previousStays: Number(autoPreviousStays) || 1,
    notes: form.notes,
    address: form.address.trim(),
    city: form.city.trim(),
    province: form.province.trim(),
    email: form.email.trim(),
    guestPhone: form.guestPhone.trim() || '-',
    guestNationality: form.guestNationality.trim() || 'ລາວ',
    dob: form.dob,
    passportNo: form.passportNo.trim().toUpperCase(),
    regPayMethod: form.regPayMethod,
    noInvoice: form.noInvoice,
    cardLast4: form.cardLast4.trim(),
    cardExp: form.cardExp.trim(),
    signatureDataUrl: form.signatureDataUrl,
    signedAt: form.signedAt,
    idPhotoDataUrl: form.idPhotoDataUrl,
  });

  const shareTargetBooking = useMemo(() => {
    if (booking) {
      return {
        ...booking,
        ...buildRegistrationPatch(),
      };
    }
    return {
      id: form.bookingNo || `BK-${today.replace(/-/g, '').slice(2)}-${Math.floor(1000 + Math.random() * 9000)}`,
      roomId: form.roomId,
      roomNumber: activeRoom?.number || '-',
      roomType: activeRoom?.type || 'standard',
      roomPrice: activeRoom?.price || 0,
      checkIn: form.checkIn,
      checkOut: form.checkOut,
      nights,
      totalAmount: computedTotal,
      deposit: Number(collectAmount || 0),
      remainingAmount: Math.max(0, computedTotal - Number(collectAmount || 0)),
      paymentMethod: form.regPayMethod,
      bookingChannel: 'walkin',
      status: 'booked',
      bookedByStaff: currentUser?.name || 'admin',
      ...buildRegistrationPatch(),
    };
  }, [booking, form, activeRoom, nights, computedTotal, collectAmount, currentUser, today]);

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImageFile(file);
      set('idPhotoDataUrl', compressed);
      toast('📸 ແນບຮູບບັດ/ພາສປອດສຳເລັດ', 'success');
    } catch {
      toast('❌ ບໍ່ສາມາດອ່ານໄຟລ໌ຮູບໄດ້', 'error');
    } finally {
      e.target.value = '';
    }
  };

  const mapPayMethodForAccounting = (m) => {
    if (m === 'debit' || m === 'credit' || m === 'card') return 'card';
    if (m === 'transfer' || m === 'company') return 'transfer';
    if (m === 'qr') return 'qr';
    return 'cash';
  };

  const handleSaveOrCheckIn = (mode = 'confirm') => {
    if (!composedFullName) {
      toast('⚠️ ກະລຸນາໃສ່ຊື່ລູກຄ້າ (First / Last Name)', 'error');
      return;
    }

    const patch = buildRegistrationPatch();

    // Case 1: New Walk-in Check-in directly from iPad Registration Form
    if (isWalkInNew) {
      if (!form.roomId) {
        toast('⚠️ ກະລຸນາເລືອກຫ້ອງພັກ', 'error');
        return;
      }
      if (!form.checkIn || !form.checkOut || form.checkIn >= form.checkOut) {
        toast('⚠️ ວັນທີເຂົ້າ-ອອກບໍ່ຖືກຕ້ອງ', 'error');
        return;
      }
      if (!isRoomAvailableForDates(form.roomId, form.checkIn, form.checkOut)) {
        toast(`⚠️ ຫ້ອງ ${activeRoom?.number || form.roomId} ບໍ່ວ່າງໃນຊ່ວງວັນທີນີ້`, 'error');
        return;
      }
      const accountingMethod = mapPayMethodForAccounting(form.regPayMethod);
      const paidNow = Number(collectAmount || 0);
      const created = createBooking({
        ...patch,
        roomId: form.roomId,
        checkIn: form.checkIn,
        checkOut: form.checkOut,
        nights,
        roomPrice: activeRoom?.price || 0,
        discount: 0,
        totalAmount: computedTotal,
        deposit: paidNow,
        remainingAmount: Math.max(0, computedTotal - paidNow),
        paymentMethod: accountingMethod,
        bookedByStaff: currentUser?.name || 'ພະນັກງານຕ້ອນຮັບ',
        bookingChannel: 'walkin',
        isDirectCheckIn: true,
        status: 'checked_in',
      });
      toast(`✅ Check-in & ລົງທະບຽນຫ້ອງ ${activeRoom?.number} ສຳເລັດ!`, 'success');
      if (onCompleted) {
        onCompleted(created);
      } else {
        setReceiptState({
          booking: created,
          room: activeRoom,
          type: 'checkin',
          paidAmount: paidNow,
          payMethod: accountingMethod,
        });
      }
      return;
    }

    // Case 2: Existing booking waiting to Check-in (`booked`)
    if (booking.status === 'booked' && mode === 'confirm') {
      const accountingMethod = mapPayMethodForAccounting(form.regPayMethod);
      const paidNow = Number(collectAmount || 0);
      const groupSiblings = booking.groupId
        ? bookings.filter(b => b.groupId === booking.groupId && b.status === 'booked')
        : [booking];

      groupSiblings.forEach((gb, idx) => {
        const gbPaid = idx === 0 ? paidNow : 0;
        checkIn(gb.id, { amount: gbPaid, method: accountingMethod }, {
          ...patch,
          ...(booking.groupId ? {
            groupPaidAmount: depositPaid + paidNow,
            groupRemainingAmount: Math.max(0, computedTotal - (depositPaid + paidNow)),
          } : {}),
        });
      });

      const nextBookingObj = {
        ...booking,
        ...patch,
        status: 'checked_in',
        remainingPaid: paidNow,
        remainingPaymentMethod: accountingMethod,
        remainingAmount: Math.max(0, computedTotal - (depositPaid + paidNow)),
        ...(booking.groupId ? {
          groupPaidAmount: depositPaid + paidNow,
          groupRemainingAmount: Math.max(0, computedTotal - (depositPaid + paidNow)),
        } : {}),
      };
      toast(`✅ Check-in & ບັນທຶກໃບລົງທະບຽນຫ້ອງ ${roomNumbersDisplay} ສຳເລັດ!`, 'success');
      if (onCompleted) {
        onCompleted(nextBookingObj);
      } else {
        setReceiptState({
          booking: nextBookingObj,
          room: activeRoom,
          type: 'checkin',
          paidAmount: depositPaid + paidNow,
          payMethod: accountingMethod,
        });
      }
      return;
    }

    // Case 3: Update registration details & signature (already checked_in or saving draft on booked)
    const groupSiblings = booking.groupId
      ? bookings.filter(b => b.groupId === booking.groupId)
      : [booking];
    groupSiblings.forEach(gb => updateBooking(gb.id, patch));
    toast(
      form.signatureDataUrl
        ? `✅ ບັນທຶກໃບລົງທະບຽນ & ລາຍເຊັນສຳເລັດ! (${booking.id})`
        : `💾 ບັນທຶກຂໍ້ມູນໃບລົງທະບຽນສຳເລັດ! (${booking.id})`,
      'success'
    );
    if (onCompleted) {
      onCompleted({ ...booking, ...patch });
    } else {
      onClose();
    }
  };

  if (receiptState) {
    return (
      <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
        <div className="modal modal-lg">
          <div className="modal-header">
            <span className="modal-title">🧾 ໃບຮັບເງິນ Check-in — ຫ້ອງ {roomNumbersDisplay}</span>
            <button type="button" className="modal-close" onClick={onClose}>✕</button>
          </div>
          <div className="modal-body" style={{ maxHeight: '72vh', overflowY: 'auto' }}>
            <PrintReceipt
              booking={receiptState.booking}
              room={receiptState.room}
              type={receiptState.type}
              paidAmount={receiptState.paidAmount}
              payMethod={receiptState.payMethod}
            />
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={() => setReceiptState(null)}>
              📝 ກັບໄປເບິ່ງໃບລົງທະບຽນ
            </button>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              ✅ ສຳເລັດ
            </button>
            <button type="button" className="btn btn-primary btn-lg" onClick={() => window.print()}>
              🖨️ ພິມໃບຮັບເງິນ
            </button>
          </div>
        </div>
      </div>
    );
  }

  const payCheckboxes = [
    { key: 'cash', label: biLabel('payCash') },
    { key: 'transfer', label: biLabel('payTransfer') },
    { key: 'qr', label: biLabel('payQr') },
    { key: 'company', label: biLabel('payCompany') },
    { key: 'debit', label: formLang === 'bi' ? 'ບັດເດບິດ / Debit Card' : (baseLang === 'en' ? 'Debit Card' : T.payCard) },
    { key: 'credit', label: formLang === 'bi' ? 'ບັດເຄຣດິດ / Credit Card (Visa/Master/JCB)' : `${T.payCard} (Visa/Master/JCB)` },
  ];

  const handleCopyShareText = () => {
    const text = `🏨 ໃບຢືນຢັນການຈອງຫ້ອງພັກ — ${hotelInfo?.name || 'ຣີສອດຕາດຟານ'} (Tad Fane Resort)
━━━━━━━━━━━━━━━━━━━━
📌 ລະຫັດການຈອງ: ${booking?.id || form.bookingNo || '-'}
👤 ຊື່ລູກຄ້າ: ${composedFullName || form.firstName || '-'}
${form.guestPhone ? `📞 ເບີໂທ: ${form.guestPhone}` : ''}
🏨 ຫ້ອງພັກ: ຫ້ອງ ${roomNumbersDisplay}
📅 ວັນເຂົ້າພັກ: ${form.checkIn || '-'}
🚪 ວັນອອກ: ${form.checkOut || '-'} (${nights} ຄືນ)
💰 ຍອດລວມ: ${formatCurrency(computedTotal)}
${depositPaid > 0 ? `💵 ມັດຈຳແລ້ວ: ${formatCurrency(depositPaid)}` : ''}
${(computedTotal - depositPaid) > 0 ? `💳 ຍອດຄ້າງຊຳລະ: ${formatCurrency(computedTotal - depositPaid)}` : '✅ ຊຳລະຄົບຖ້ວນແລ້ວ'}
📝 ສະຖານະ: ${booking?.status === 'checked_in' ? 'ກຳລັງເຂົ້າພັກ' : 'ຢືນຢັນການຈອງແລ້ວ'}
${form.signatureDataUrl ? '✍️ ລາຍເຊັນ: ເຊັນຢືນຢັນຮຽບຮ້ອຍແລ້ວ' : '✍️ ລາຍເຊັນ: ພ້ອມລາຍເຊັນ'}
━━━━━━━━━━━━━━━━━━━━
📍 ທີ່ຕັ້ງ: ${hotelInfo?.address || 'ບ້ານ ໜອງກົກ, ເມືອງ ປາກຊ່ອງ (Km 38)'}
📞 ໂທ: ${hotelInfo?.phone || '+85620 98663366'}
💬 LINE: ${hotelInfo?.lineContact || '@tadfane'}
ຂອບໃຈທີ່ເລືອກພັກກັບພວກເຮົາ!`;

    navigator.clipboard.writeText(text).then(() => {
      toast('📋 ສຳເນົາຂໍ້ຄວາມສຳເລັດ! ສາມາດ Paste ສົ່ງໃນ LINE / WhatsApp ໃຫ້ແຂກໄດ້ເລີຍ', 'success');
    }).catch(() => {
      toast('ບໍ່ສາມາດສຳເນົາໄດ້ ກະລຸນາລອງໃໝ່', 'error');
    });
  };

  return createPortal(
    <div className="reg-overlay">
      {/* Top Tablet Navigation Bar (Inspired by iPad Hotel App) */}
      <header className="reg-topbar no-print">
        <div className="reg-topbar-left">
          <button
            type="button"
            className="reg-back-btn"
            onClick={onBack || onClose}
            title="ກັບຄືນ"
          >
            ‹
          </button>
          <div>
            <div className="reg-topbar-name">
              {composedFullName || 'Walk-in Guest'}
              <span className="reg-room-pill">ຫ້ອງ {roomNumbersDisplay}</span>
              {form.signatureDataUrl && (
                <span className="reg-signed-pill">✅ ເຊັນແລ້ວ</span>
              )}
            </div>
            <div className="reg-topbar-ref">
              {booking ? booking.id : 'NEW WALK-IN REGISTRATION'} · {booking?.status === 'checked_in' ? 'Checked-in' : 'Check-in'}
            </div>
          </div>
        </div>

        <div className="reg-topbar-actions">
          {/* Language switcher for guest convenience */}
          <div className="reg-lang-group">
            {[
              { key: 'bi', label: '🇱🇦+🇬🇧' },
              { key: 'lo', label: 'ລາວ' },
              { key: 'en', label: 'EN' },
              { key: 'th', label: 'ไทย' },
              { key: 'vi', label: 'VN' },
            ].map(l => (
              <button
                key={l.key}
                type="button"
                className={`reg-lang-btn ${formLang === l.key ? 'active' : ''}`}
                onClick={() => setFormLang(l.key)}
              >
                {l.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            className={`reg-icon-btn ${guestHandoffMode ? 'active' : ''}`}
            onClick={() => setGuestHandoffMode(v => !v)}
            title={guestHandoffMode ? 'ປົດລັອກໂໝດພະນັກງານ' : 'ໂໝດຍື່ນ iPad ໃຫ້ແຂກກວດ & ເຊັນ'}
          >
            {guestHandoffMode ? '🔒 ໂໝດແຂກ' : '📱 ຍື່ນໃຫ້ແຂກ'}
          </button>

          {!guestHandoffMode && (
            <>
              <button
                type="button"
                className="reg-icon-btn"
                style={{
                  padding: '6px 12px',
                  fontSize: '0.8rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  background: '#eff6ff',
                  color: '#1d4ed8',
                  border: '1px solid #93c5fd',
                  fontWeight: 700,
                }}
                onClick={() => setShowShareModal(true)}
                title="ສົ່ງລິ້ງ & QR Code ໃຫ້ແຂກເປີດ/ເຊັນຊື່ໃນໂທລະສັບ"
              >
                🔗 {baseLang === 'en' ? 'Share Link & QR' : 'ລິ້ງ & QR ໃຫ້ແຂກ'}
              </button>
              <button
                type="button"
                className="reg-icon-btn"
                style={{ padding: '6px 12px', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '5px', background: '#ecfdf5', color: '#166534', border: '1px solid #86efac', fontWeight: 700 }}
                onClick={handleCopyShareText}
                title="ກັອບປີ້ຂໍ້ຄວາມສະຫຼຸບການຈອງສົ່ງໃຫ້ແຂກຜ່ານ LINE / WhatsApp"
              >
                💬 {baseLang === 'en' ? 'Copy for LINE' : 'ກັອບປີ້ສົ່ງ LINE'}
              </button>
              <button
                type="button"
                className="reg-icon-btn"
                onClick={() => setHideRoomRate(v => !v)}
                title="ເຊື່ອງ/ສະແດງລາຄາຫ້ອງ"
              >
                {hideRoomRate ? '👁️ ສະແດງລາຄາ' : '🙈 ເຊື່ອງລາຄາ'}
              </button>
              <button
                type="button"
                className={`reg-icon-btn ${form.idPhotoDataUrl ? 'has-attachment' : ''}`}
                onClick={() => fileInputRef.current?.click()}
                title="ແນບຮູບບັດປະຈຳຕົວ / ພາສປອດ"
              >
                📎
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                style={{ display: 'none' }}
                onChange={handlePhotoUpload}
              />
              <button
                type="button"
                className="reg-icon-btn"
                onClick={() => window.print()}
                title="ພິມໃບລົງທະບຽນ / Save PDF"
              >
                🖨️
              </button>
            </>
          )}
        </div>
      </header>

      {/* Main Scrollable Tablet Sheet Area — 2 A4 Pages */}
      <div className="reg-scroll-area">
        <div className="reg-printable reg-a4-stack">
          {/* ================= PAGE 1 OF 2: BOOKING, GUEST & PAYMENT ================= */}
          <div className="reg-paper reg-a4-page">
            <div className="reg-page-badge">📄 ໃບທີ 1 / 2</div>
            {/* Hotel Header + Form Title */}
            <div className="reg-paper-header">
              <div className="reg-hotel-brand">
                <div className="reg-hotel-name">
                  {hotelInfo?.name || 'ຣີສອດຕາດຟານ'} · {hotelInfo?.nameEn || 'Tad Fane Resort'}
                </div>
                <div className="reg-hotel-meta">
                  {hotelInfo?.address} {hotelInfo?.phone ? `· Tel: ${hotelInfo.phone}` : ''}
                </div>
              </div>
              <h1 className="reg-doc-title">
                {formLang === 'bi'
                  ? (booking?.status === 'booked'
                    ? 'ໃບຢືນຢັນການຈອງ & ລົງທະບຽນ / RESORT BOOKING CONFIRMATION & REGISTRATION FORM'
                    : `${FORM_TEXT.lo.formTitle} / ${TEN.formTitle}`)
                  : (booking?.status === 'booked'
                    ? (baseLang === 'en' ? 'RESORT BOOKING CONFIRMATION & REGISTRATION FORM' : 'ໃບຢືນຢັນການຈອງ & ລົງທະບຽນຫ້ອງພັກ')
                    : T.formTitle)}
              </h1>
            </div>

            {/* SECTION 1: BOOKING INFORMATION */}
            <div className="reg-section-heading">1. {biLabel('secBooking')}</div>
            <div className="reg-table">
              <div className="reg-row reg-cols-3">
                <div className="reg-cell">
                  <span className="reg-label">{biLabel('titlePrefix')}:</span>
                  <select
                    className="reg-input"
                    value={form.guestTitle}
                    onChange={e => set('guestTitle', e.target.value)}
                  >
                    <option value="">—</option>
                    <option value="Mr.">Mr. / ທ້າວ</option>
                    <option value="Ms.">Ms. / ນາງ</option>
                    <option value="Mrs.">Mrs. / ທ່ານນາງ</option>
                    <option value="Dr.">Dr.</option>
                    <option value="ທ່ານ">ທ່ານ</option>
                  </select>
                </div>
                <div className="reg-cell">
                  <span className="reg-label">{biLabel('lastName')}:</span>
                  <input
                    className="reg-input reg-bold"
                    placeholder="Souansavanh"
                    value={form.lastName}
                    onChange={e => set('lastName', e.target.value)}
                  />
                </div>
                <div className="reg-cell">
                  <span className="reg-label">{biLabel('firstName')}:</span>
                  <input
                    className="reg-input reg-bold"
                    placeholder="First name"
                    value={form.firstName}
                    onChange={e => set('firstName', e.target.value)}
                  />
                </div>
              </div>

              <div className="reg-row reg-cols-3">
                <div className="reg-cell">
                  <span className="reg-label">{biLabel('bookingNo')}:</span>
                  <span className="reg-static reg-bold">{booking?.id || 'WALK-IN'}</span>
                </div>
                <div className="reg-cell">
                  <span className="reg-label">{biLabel('roomNo')}:</span>
                  {isWalkInNew ? (
                    <select
                      className="reg-input reg-bold"
                      value={form.roomId}
                      onChange={e => set('roomId', e.target.value)}
                    >
                      <option value="">— ເລືອກຫ້ອງ —</option>
                      {rooms.map(r => {
                        const avail = isRoomAvailableForDates(r.id, form.checkIn, form.checkOut);
                        return (
                          <option key={r.id} value={r.id} disabled={!avail}>
                            {r.number} ({ROOM_TYPES[r.type]}) {avail ? '' : '— ບໍ່ວ່າງ'}
                          </option>
                        );
                      })}
                    </select>
                  ) : (
                    <span className="reg-static reg-bold">{roomNumbersDisplay}</span>
                  )}
                </div>
                <div className="reg-cell">
                  <span className="reg-label">{biLabel('roomType')}:</span>
                  <span className="reg-static reg-bold">{roomTypeText}</span>
                </div>
              </div>

              <div className="reg-row reg-cols-3">
                <div className="reg-cell">
                  <span className="reg-label">{biLabel('checkInDate')}:</span>
                  {isWalkInNew ? (
                    <input
                      type="date"
                      className="reg-input reg-bold"
                      value={form.checkIn}
                      onChange={e => set('checkIn', e.target.value)}
                    />
                  ) : (
                    <span className="reg-static reg-bold">{form.checkIn}</span>
                  )}
                </div>
                <div className="reg-cell">
                  <span className="reg-label">{biLabel('guestCount')}:</span>
                  <div className="reg-pax-inline">
                    <input
                      type="number"
                      min="1"
                      max="10"
                      className="reg-mini-num"
                      value={form.adults}
                      onChange={e => set('adults', e.target.value)}
                    />
                    <span>(A) /</span>
                    <input
                      type="number"
                      min="0"
                      max="10"
                      className="reg-mini-num"
                      value={form.children}
                      onChange={e => set('children', e.target.value)}
                    />
                    <span>(C)</span>
                  </div>
                </div>
                <div className="reg-cell">
                  <span className="reg-label">{biLabel('roomRate')}:</span>
                  <span className="reg-static reg-bold">
                    {hideRoomRate ? '••••••' : formatCurrency(unitPrice)}
                  </span>
                </div>
              </div>

              <div className="reg-row reg-cols-3">
                <div className="reg-cell">
                  <span className="reg-label">{biLabel('checkOutDate')}:</span>
                  {isWalkInNew ? (
                    <input
                      type="date"
                      className="reg-input reg-bold"
                      min={addDays(form.checkIn, 1)}
                      value={form.checkOut}
                      onChange={e => set('checkOut', e.target.value)}
                    />
                  ) : (
                    <span className="reg-static reg-bold">{form.checkOut}</span>
                  )}
                </div>
                <div className="reg-cell">
                  <span className="reg-label">{biLabel('nights')}:</span>
                  <span className="reg-static reg-bold">{nights}</span>
                </div>
                <div className="reg-cell">
                  <span className="reg-label">{biLabel('flight')}:</span>
                  <input
                    className="reg-input"
                    placeholder="—"
                    value={form.flightInfo}
                    onChange={e => set('flightInfo', e.target.value)}
                  />
                </div>
              </div>

              <div className="reg-row reg-cols-3">
                <div className="reg-cell">
                  <span className="reg-label">{biLabel('bookedVia')}:</span>
                  <input
                    className="reg-input"
                    placeholder="Walk-in / Company"
                    value={form.company}
                    onChange={e => set('company', e.target.value)}
                  />
                </div>
                <div className="reg-cell">
                  <span className="reg-label">{biLabel('prevStays')}:</span>
                  <input
                    type="number"
                    min="1"
                    className="reg-input"
                    value={autoPreviousStays}
                    onChange={e => set('previousStays', e.target.value)}
                  />
                </div>
                <div className="reg-cell">
                  <span className="reg-label">{biLabel('notes')}:</span>
                  <input
                    className="reg-input"
                    placeholder="—"
                    value={form.notes}
                    onChange={e => set('notes', e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* SECTION 2: GUEST INFORMATION */}
            <div className="reg-section-heading">2. {biLabel('secGuest')}</div>
            <div className="reg-table">
              <div className="reg-row reg-cols-3">
                <div className="reg-cell">
                  <span className="reg-label">{biLabel('address')}:</span>
                  <input
                    className="reg-input"
                    placeholder="ບ້ານ / ຖະໜົນ..."
                    value={form.address}
                    onChange={e => set('address', e.target.value)}
                  />
                </div>
                <div className="reg-cell">
                  <span className="reg-label">{biLabel('city')}:</span>
                  <input
                    className="reg-input"
                    placeholder="ເມືອງ..."
                    value={form.city}
                    onChange={e => set('city', e.target.value)}
                  />
                </div>
                <div className="reg-cell">
                  <span className="reg-label">{biLabel('province')}:</span>
                  <input
                    className="reg-input"
                    placeholder="ແຂວງ..."
                    value={form.province}
                    onChange={e => set('province', e.target.value)}
                  />
                </div>
              </div>

              <div className="reg-row reg-cols-3">
                <div className="reg-cell">
                  <span className="reg-label">{biLabel('email')}:</span>
                  <input
                    type="email"
                    className="reg-input"
                    placeholder="name@email.com"
                    value={form.email}
                    onChange={e => set('email', e.target.value)}
                  />
                </div>
                <div className="reg-cell">
                  <span className="reg-label">{biLabel('phone')}:</span>
                  <input
                    type="tel"
                    className="reg-input reg-bold"
                    placeholder="020 xxxx xxxx"
                    value={form.guestPhone}
                    onChange={e => set('guestPhone', e.target.value)}
                  />
                </div>
                <div className="reg-cell">
                  <span className="reg-label">{biLabel('country')}:</span>
                  <input
                    className="reg-input reg-bold"
                    placeholder="LA / VN / TH..."
                    value={form.guestNationality}
                    onChange={e => set('guestNationality', e.target.value)}
                  />
                </div>
              </div>

              <div className="reg-row reg-cols-3">
                <div className="reg-cell">
                  <span className="reg-label">{biLabel('dob')}:</span>
                  <input
                    type="date"
                    className="reg-input reg-bold"
                    value={form.dob}
                    onChange={e => set('dob', e.target.value)}
                  />
                </div>
                <div className="reg-cell reg-span-2">
                  <span className="reg-label">{biLabel('idNo')}:</span>
                  <input
                    className="reg-input reg-bold"
                    style={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}
                    placeholder="PA0209560 / ເລກບັດປະຈຳຕົວ"
                    value={form.passportNo}
                    onChange={e => set('passportNo', e.target.value)}
                  />
                </div>
              </div>
            </div>

            {form.idPhotoDataUrl && (
              <div className="reg-id-attachment no-print">
                <img
                  src={form.idPhotoDataUrl}
                  alt="ID/Passport"
                  onClick={() => setShowIdPreview(true)}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.82rem', color: '#0f172a' }}>
                    📸 ແນບຮູບບັດປະຈຳຕົວ / ພາສປອດແລ້ວ
                  </div>
                  <div style={{ fontSize: '0.74rem', color: '#64748b' }}>
                    ກົດໃສ່ຮູບເພື່ອຂະຫຍາຍເບິ່ງ
                  </div>
                </div>
                {!guestHandoffMode && (
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    onClick={() => set('idPhotoDataUrl', '')}
                  >
                    🗑️ ລຶບຮູບ
                  </button>
                )}
              </div>
            )}

            {/* SECTION 3: PAYMENT METHOD */}
            <div className="reg-section-heading">3. {biLabel('secPayment')}</div>
            <div className="reg-table">
              <div className="reg-pay-checkboxes">
                {payCheckboxes.map(opt => {
                  const checked = form.regPayMethod === opt.key;
                  return (
                    <label key={opt.key} className={`reg-check-item ${checked ? 'checked' : ''}`}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => set('regPayMethod', opt.key)}
                      />
                      <span className="reg-checkbox-box">{checked ? '✓' : ''}</span>
                      <span>{opt.label}</span>
                    </label>
                  );
                })}
              </div>

              <div className="reg-row reg-cols-3">
                <div className="reg-cell">
                  <span className="reg-label">{biLabel('cardNo')}:</span>
                  <input
                    className="reg-input"
                    maxLength={19}
                    placeholder="**** **** **** 1234"
                    value={form.cardLast4}
                    onChange={e => set('cardLast4', e.target.value)}
                  />
                </div>
                <div className="reg-cell">
                  <span className="reg-label">{biLabel('cardExp')}:</span>
                  <input
                    className="reg-input"
                    maxLength={7}
                    placeholder="MM/YY"
                    value={form.cardExp}
                    onChange={e => set('cardExp', e.target.value)}
                  />
                </div>
                <div className="reg-cell">
                  <label className="reg-check-item" style={{ margin: 0 }}>
                    <input
                      type="checkbox"
                      checked={form.noInvoice}
                      onChange={e => set('noInvoice', e.target.checked)}
                    />
                    <span className="reg-checkbox-box">{form.noInvoice ? '✓' : ''}</span>
                    <span>{biLabel('noInvoice')}</span>
                  </label>
                </div>
              </div>

              {!hideRoomRate && (
                <div className="reg-row reg-cols-3" style={{ background: '#f8fafc' }}>
                  <div className="reg-cell">
                    <span className="reg-label">{formLang === 'bi' ? 'ຍອດລວມ / Total' : 'Total'}:</span>
                    <span className="reg-static reg-bold">{formatCurrency(computedTotal)}</span>
                  </div>
                  <div className="reg-cell">
                    <span className="reg-label">{formLang === 'bi' ? 'ຊຳລະແລ້ວ / Paid' : 'Paid'}:</span>
                    <span className="reg-static reg-bold" style={{ color: '#15803d' }}>
                      {formatCurrency(depositPaid + priorRemainingPaid)}
                    </span>
                  </div>
                  <div className="reg-cell">
                    <span className="reg-label">{formLang === 'bi' ? 'ຊຳລະຕອນເຂົ້າ / Due' : 'Due Now'}:</span>
                    {(!guestHandoffMode && (isWalkInNew || booking?.status === 'booked')) ? (
                      <input
                        type="number"
                        min="0"
                        className="reg-input reg-bold"
                        style={{ color: '#b45309' }}
                        value={collectAmount}
                        onChange={e => setCollectAmount(Number(e.target.value))}
                      />
                    ) : (
                      <span className="reg-static reg-bold" style={{ color: '#b45309' }}>
                        {formatCurrency(booking?.remainingAmount ?? collectAmount)}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="reg-a4-footer">
              <span>{hotelInfo?.name || 'ຣີສອດຕາດຟານ'} · ໃບທີ 1 / 2 (ຂໍ້ມູນການຈອງ & ລູກຄ້າ)</span>
              <span>ອ่านຂໍ້ກຳນົດ ແລະ ເຊັນຊື່ໃນໃບທີ 2 / 2 →</span>
            </div>
          </div>

          {/* ================= PAGE 2 OF 2: HOTEL RULES & SIGNATURES ================= */}
          <div className="reg-paper reg-a4-page reg-a4-page-2">
            <div className="reg-page-badge">📜 ໃບທີ 2 / 2</div>
            <div className="reg-paper-header">
              <div className="reg-hotel-brand">
                <div className="reg-hotel-name">
                  {hotelInfo?.name || 'ຣີສອດຕາດຟານ'} · {hotelInfo?.nameEn || 'Tad Fane Resort'}
                </div>
                <div className="reg-hotel-meta">
                  ເລກຈອງ / Ref: <strong>{booking?.id || 'WALK-IN'}</strong> · ຫ້ອງ / Room: <strong>{activeRoom?.number || '-'}</strong> · ລູກຄ້າ / Guest: <strong>{composedFullName || '-'}</strong>
                </div>
              </div>
              <h2 className="reg-doc-subtitle">
                {biLabel('secTerms')}
              </h2>
            </div>

            {/* SECTION 4: TERMS & CONDITIONS */}
            <ol className="reg-rules-list reg-rules-a4">
              {rulesList.map((rule, idx) => (
                <li key={idx}>
                  {formLang === 'bi' ? (
                    <>
                      <div>{rule.lo}</div>
                      <div className="reg-rule-en">{rule.en}</div>
                    </>
                  ) : (
                    <div>{rule.main}</div>
                  )}
                </li>
              ))}
            </ol>

            {/* AGREEMENT & SIGNATURE DISPLAY */}
            <div className="reg-agreement-box">
              {formLang === 'bi' ? (
                <>
                  <p>{FORM_TEXT.lo.agreeText(hotelInfo?.name || 'ຣີສອດຕາດຟານ')}</p>
                  <p style={{ marginTop: '4px', color: '#475569' }}>
                    {TEN.agreeText(hotelInfo?.nameEn || 'Tad Fane Resort')}
                  </p>
                </>
              ) : (
                <p>{T.agreeText(baseLang === 'en' ? (hotelInfo?.nameEn || 'Tad Fane Resort') : (hotelInfo?.name || 'ຣີສອດຕາດຟານ'))}</p>
              )}
            </div>

            <div className="reg-signatures-grid" style={{ marginTop: 'auto', paddingTop: '18px' }}>
              <div
                className="reg-signature-box"
                onClick={() => setShowSigPad(true)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && setShowSigPad(true)}
              >
                <div className="reg-sig-title">{biLabel('guestSigLabel')}</div>
                <div className="reg-sig-area" style={{ height: '96px' }}>
                  {form.signatureDataUrl ? (
                    <img src={form.signatureDataUrl} alt="Guest signature" className="reg-sig-img" style={{ maxHeight: '88px' }} />
                  ) : (
                    <span className="reg-sig-placeholder no-print">{T.notSignedYet}</span>
                  )}
                </div>
                <div className="reg-sig-meta">
                  <span>{composedFullName || '____________________'}</span>
                  {form.signedAt && (
                    <span>
                      {T.signedAtLabel}: {new Date(form.signedAt).toLocaleString('en-GB', { hour12: false })}
                    </span>
                  )}
                </div>
              </div>

              <div className="reg-signature-box reg-signature-staff">
                <div className="reg-sig-title">{biLabel('staffSigLabel')}</div>
                <div className="reg-sig-area" style={{ height: '96px' }}>
                  <span className="reg-staff-stamp">
                    {booking?.bookedByStaff || currentUser?.name || 'Reception'}
                  </span>
                </div>
                <div className="reg-sig-meta">
                  <span>{hotelInfo?.nameEn || 'Tad Fane Resort'}</span>
                  <span>{today}</span>
                </div>
              </div>
            </div>

            <div className="reg-a4-footer">
              <span>{hotelInfo?.name || 'ຣີສອດຕາດຟານ'} · ໃບທີ 2 / 2 (ຂໍ້ກຳນົດ & ລາຍເຊັນ)</span>
              <span>ຂອບໃຈທີ່ໃຊ້ບໍລິການ / Thank you for staying with us</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Sticky Action Bar + Floating Orange Signature Button (Exact iPad Counter Experience) */}
      <div className="reg-bottom-bar no-print">
        <div className="reg-bottom-actions">
          {guestHandoffMode ? (
            <button
              type="button"
              className="btn btn-success btn-lg"
              style={{ fontWeight: 800, padding: '12px 22px' }}
              onClick={() => {
                setGuestHandoffMode(false);
                toast('✅ ຮັບຂໍ້ມູນຈາກແຂກແລ້ວ — ກວດສອບ ແລະ ບັນທຶກໃບຈອງໄດ້ເລີຍ', 'success');
              }}
            >
              ✅ ກວດສອບ & ເຊັນສຳເລັດ (ສົ່ງຄືນເຄົາເຕີ້)
            </button>
          ) : (
            <>
              <button
                type="button"
                className="btn btn-secondary"
                style={{
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: '#eff6ff',
                  color: '#1d4ed8',
                  borderColor: '#93c5fd',
                }}
                onClick={() => setShowShareModal(true)}
                title="ສົ່ງລິ້ງ & QR Code ໃຫ້ແຂກໂຫຼດເຂົ້າໂທລະສັບ"
              >
                🔗 ສົ່ງລິ້ງໃຫ້ແຂກ (QR / Link)
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleCopyShareText}
                title="ກັອບປີ້ຂໍ້ຄວາມສະຫຼຸບສົ່ງໃຫ້ແຂກ"
              >
                💬 ກັອບປີ້ສົ່ງ LINE
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => window.print()}
                title="ພິມ ຫຼື Save ເປັນ PDF ເພື່ອສົ່ງໃຫ້ແຂກ"
              >
                🖨️ ພິມ / Save PDF
              </button>

              {booking?.status === 'booked' ? (
                <button
                  type="button"
                  className="btn btn-success btn-lg"
                  style={{ fontWeight: 800, padding: '12px 24px', fontSize: '1rem' }}
                  onClick={() => handleSaveOrCheckIn('draft')}
                >
                  💾 ບັນທຶກໃບຈອງ & ລາຍເຊັນ
                </button>
              ) : isWalkInNew ? (
                <button
                  type="button"
                  className="btn btn-success btn-lg"
                  style={{ fontWeight: 800, padding: '12px 24px', fontSize: '1rem' }}
                  onClick={() => handleSaveOrCheckIn('confirm')}
                >
                  ✅ ຢືນຢັນ Check-in & ບັນທຶກ
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-success btn-lg"
                  style={{ fontWeight: 800, padding: '12px 24px', fontSize: '1rem' }}
                  onClick={() => handleSaveOrCheckIn('update')}
                >
                  💾 ບັນທຶກໃບລົງທະບຽນ & ລາຍເຊັນ
                </button>
              )}
            </>
          )}
        </div>

        {/* Floating Orange Signature Button matching the iPad reference */}
        <button
          type="button"
          className="reg-fab-signature"
          onClick={() => setShowSigPad(true)}
        >
          <span>✍️</span>
          <span>{form.signatureDataUrl ? T.btnEditSignature : T.btnSignature}</span>
        </button>
      </div>

      {/* Signature Canvas Modal */}
      {showSigPad && (
        <SignaturePadModal
          guestName={composedFullName}
          initialSignature={form.signatureDataUrl}
          labels={{
            title: `✍️ ${biLabel('guestSigLabel')}`,
            clear: baseLang === 'en' ? '🗑️ Clear' : '🗑️ ລ້າງ',
            undo: baseLang === 'en' ? '↩️ Undo' : '↩️ ຍ້ອນກັບ',
            cancel: baseLang === 'en' ? 'Cancel' : 'ຍົກເລີກ',
            save: baseLang === 'en' ? '✅ Apply Signature' : '✅ ບັນທຶກລາຍເຊັນ',
          }}
          onSave={(dataUrl) => {
            set('signatureDataUrl', dataUrl);
            set('signedAt', dataUrl ? new Date().toISOString() : '');
            setShowSigPad(false);
            if (dataUrl) toast('✍️ ບັນທຶກລາຍເຊັນລູກຄ້າແລ້ວ!', 'success');
          }}
          onClose={() => setShowSigPad(false)}
        />
      )}

      {/* Share Booking Link & QR Code Modal */}
      {showShareModal && (
        <ShareBookingModal
          booking={shareTargetBooking}
          room={activeRoom}
          hotelInfo={hotelInfo}
          onClose={() => setShowShareModal(false)}
        />
      )}

      {/* ID Photo Lightbox */}
      {showIdPreview && form.idPhotoDataUrl && (
        <div
          className="sig-modal-overlay no-print"
          onClick={() => setShowIdPreview(false)}
        >
          <div className="modal" style={{ maxWidth: '640px', padding: '16px' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <strong>📸 ຮູບບັດປະຈຳຕົວ / ພາສປອດ</strong>
              <button type="button" className="modal-close" onClick={() => setShowIdPreview(false)}>✕</button>
            </div>
            <img src={form.idPhotoDataUrl} alt="Guest ID" style={{ width: '100%', borderRadius: '10px', maxHeight: '70vh', objectFit: 'contain' }} />
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}
