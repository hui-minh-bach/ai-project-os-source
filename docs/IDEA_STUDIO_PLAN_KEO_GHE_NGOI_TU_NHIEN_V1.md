# IDEA STUDIO - KE HOACH KEO GHE, NGOI, LAM VIEC, DUNG DAY (V1)

Nguon: AI Project OS v0.9.60; phong 2D `public/assets/office-iso-backdrop.jpg`, TAM19 `public/assets/tam19.glb`, rig TAM19 va `office-motion.mjs`.

## 1. Chot huong my thuat
- **Bao toan 100% khong gian 2D goc** (boong vu tru xanh - vang, ban, cua so, man hinh, ong sac, long kinh). Khong thay bang mot phong 3D toi/goc canh khac.
- Camera ban dau toan canh, sau do zoom vao mot **tram ban mau phia truoc**. Camera phim la 2.5D co dinh goc de giu hinh goc; khong bao gio quang cao la 3D 360 do.
- Vat the can tuong tac duoc: tach ghe ra khoi anh tinh; tao anh nen da xoa ghe; khi khong keo, ghe phai o DUNG vi tri goc. Ghe dich chuyen nhu 1 vat the, co bong tiep xuc.
- Robot TAM19 la model GLB goc, animation quaternion tren rig (hip/knee/ankle/shoulder/elbow/wrist/head). Khong dung chuoi sprite anh 2D de gia animation.

## 2. Choreography / timeline phim ~20 giay
| Pha | Cach dieu khien | Dieu kien qua pha |
|---|---|---|
| 0.0-2.0s: Establish | Toan canh Idea Studio goc | Ghe dung vi tri ban dau |
| 2.0-4.7s: Approach | Robot buoc den ben phai/lung ghe theo waypoint | Khong di xuyen ban/vach |
| 4.7-5.5s: Align | Xoay nguoi vao ghe, giam toc | Chan dung vung, tay chua cham ghe |
| 5.5-6.5s: Reach | Tay phai duoc dua toi lung ghe, than hoi nghieng | Tay dat gan diem nam lung ghe |
| 6.5-7.6s: Pull chair | Ghe truot luu luu tren san, robot doi trong tam | Ghe dich ra phia sau ban ~20-30px cua anh goc |
| 7.6-8.5s: Align seat | Robot buoc xuong sau lung ghe, quay hong ve phia ghe | Hong o trung tam mat ghe; khong di chuyen bang teleport |
| 8.5-9.7s: Sit | Goi/hong gap, trong tam ha xuong, chan giu san | Mong dap mat ghe; khong xuyen lung ghe |
| 9.7-10.5s: Scoot | Ghe va robot dich cung nhau sat ban mot chut | Dau goi khong xuyen mat ban |
| 10.5-13.0s: Work | Hoi tho, dau nhin man hinh, tay thao tac | Ghe dung yen khi go phim |
| 13.0-14.0s: Roll back | Dung lam viec, ghe va robot truot ra mot chut | Khoang trong dung day du |
| 14.0-15.1s: Stand | Dun nguoi len, hip/knee tra ve dung | Chan tiep san truoc khi roi ghe |
| 15.1-16.1s: Push chair | Tay cham lung, ghe duoc day ve vi tri goc | Ghe ve DUNG vi tri goc |
| 16.1-18.7s: Leave | Robot xoay, di khoi tram | Ghe khong 'tu di' theo robot |
| 18.7-20.0s: Outro | Toan canh, ghe da duoc tra ve | Phong ban dau nguyen ven |

## 3. Quy uoc toan do va che phu
- Anh goc: 1920 x 1280 px. Tram demo: ghe cua ban phia truoc, tach tu anh B2; can map lai dung station AI truoc khi gan vao logic live. Dung toa do `x,y` pixel goc, sau chuyen sang viewport bang phep bien doi camera duy nhat.
- Thu tu lop: (1) phong 2D da go ghe; (2) bong ghe/robot; (3) ghe dong; (4) robot 3D; (5) mat truoc ban (`office-iso-fg/desk-pm.png`), neu robot o sau ban; (6) nhan UI.
- Robot va ghe dung chung diem neo san, khong su dung DOM `transition:left/top` de gia di. Robot dich theo waypoint/duong cong co velocity, xoay tang toc/cham lai.
- Ghe co transform chung cho backrest, seat, piston va chan; robot phai cham ghe truoc khi ghe bat dau chuyen dong.
- Ghe/robot di theo camera co dinh: **khong goc camera 360°** khi van dung anh 2D. Khi xoay camera, phai dung phong 3D co so do vat ly rieng.

## 4. Cac trang thai ky thuat can co trong app
`IDLE -> WALK_TO_CHAIR -> TURN_TO_CHAIR -> REACH_HANDLE -> PULL_CHAIR -> STEP_TO_SEAT -> SIT_DOWN -> SCOOT_IN -> WORK -> SCOOT_OUT -> STAND_UP -> PUSH_CHAIR -> WALK_AWAY -> IDLE`.

- Khong duoc nhay pha neu animation chua hoan thanh; ket qua vao ghe phai duoc tinh theo seat target.
- Hinh dang robot va ghe co 2 cot moc giao nhau de kiem tra: `handGrip` va `seatContact`.
- Da co patch `officeMakeTam19SeatClips` cho ngoi/dung; phai them animation `Reach/Pull/Push` va di chuyen ghe dong bo theo cung clock.
- Luong app giu nguyen AI state/fleet/pinning. Phan animation la view-only, **khong gia lap ket qua AI**.

## 5. QA gate bat buoc truoc phat hanh
1. File MP4 co canh tay cham ghe truoc khi ghe truot.
2. Ghe chi truot khi Pull/Push/Scoot, khong tu di theo robot.
3. Robot di den ben ghe, xoay, ngan vua bang ghe, khong teleport.
4. Ban che chan dung thu tu; ghe khong duoc xuyen san, robot khong xuyen mat ban.
5. Khi quay lai toan canh, ghe trung voi vi tri goc, khong co bong ghe kep.
6. Trinh duyet tieu thu memory/CPU binh thuong, no-WebGL co duong lui ve 2D sprites.
7. Khi chuyen tab/app tat-mo lai, khong mat trang thai cong viec thuc.

## 6. Giao nhan
- File phim MP4 dung asset goc: cinematic storyboard co zoom can canh.
- Source patch cho chuoi hanh vi va he thong ghe/robot, kem test tu dong; khong thay the bo cai v0.9.60 khi chua xem canh trong Windows.
- Luu y: MP4 render offline la visual acceptance/POC, khong phai video cap truc tiep cua ung dung Electron; chua bao dam moi robot moi trang deu hoan hao.
