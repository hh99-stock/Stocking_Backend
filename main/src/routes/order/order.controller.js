import { sendToMatchingServer } from '../../utils/sendToMatchingServer/index.js';
export class OrderController {
  constructor(orderService) {
    this.orderService = orderService;
  }
  // test단계에서는 실제로 data가 존재하는지 확인 잘하셔야합니다. //
  // joi는 대충 만들어만 놓고 적용은 안했습니다. //
  // 나중에 로그인 구현되면 let {userId} = res.locals.user; 부분 주석해제, 아랫줄 삭제
  // 나중에 실제로 cur받아오게 되면 cur을 사용해야됨!
  // 잡다한 주석은 필수적인걸 제외하고 나중에 지우겠습니다.

  /**
   * 주문 조회 요청
   * @param {*} req params: 어떤 데이터가 필요한지.
   *                        기본 정렬:0, 시간별 정렬(오래된 순): 1, 시간별 정렬(최신순):2, 회사별 정렬(a부터): 3, 회사별 정렬(z부터): 4,
   *                        매수/ 매도(매수 먼저):5,매수/ 매도(매도 먼저):6, 체결여부(true먼저):7, 체결여부(false먼저):8
   * @param {*} res 조회된 data
   * @returns
   */

  getOrder = async (req, res) => {
    try {
      const { userId } = res.locals.user;
      const { name, type, order, isSold } = req.query;
      const result = await this.orderService.getOrder(userId, name, type, order, isSold);
      return res.status(200).json(result);
    } catch (error) {
      console.log(error.message);
      return res.status(400).json({ message: '주문 조회 도중 문제가 발생했습니다.' });
    }
  };
  // 사용자한테 보여줄때 어떤 데이터가 필요한지를 쿼리파라미터로 식별해서 다르게 보냄.
  // 정렬방식: 시간, 회사별, 매수/매도, 체결여부
  //  -> service 파트에서 추가

  //___________________________________________________________________________________________

  /**
   * 주문 생성 요청
   * @param {*} req: "companyId": 1, "type": "buy", or “sell”, "quantity": 10, "price": 32000,// price가 null이면 지정가,
   * @param {*} res: "orderId": 15, "updatedAt": "2024-03-27T16:04:36.149Z", "isSold": false, "userId": 1, "companyId": 1, "type": "buy", "timeToLive": "2024-03-28T15:42:28.338Z", "price": 32000, "quantity": 10
   * @returns
   */

  //int형으로 수정되어야하는 변수들: "companyId", "price", "quantity"
  postOrder = async (req, res) => {
    const { userId } = res.locals.user;
    const orderData = req.body;
    if (orderData.price) {
      orderData.price = 10000 * Math.floor(+orderData.price / 10000);
    }
    try {
      //주문 가능 여부 체크
      const isOrderPossible = await this.orderService.checkOrderIsPossible();
      if (!isOrderPossible) {
        return res.status(400).json({ message: '주문이 불가능한 시간입니다.' });
      }
      const jsonOrderData = {
        reqType: 'orderCreate',
        userId: userId,
        companyId: +orderData.companyId,
        orderId: null,
        type: orderData.type,
        quantity: +orderData.quantity,
        price: orderData.price,
      };
      sendToMatchingServer(JSON.stringify(jsonOrderData));
      return res.json({ message: '주문이 접수 되었습니다.' });
    } catch (error) {
      console.log(error.message);
      const { message } = error.message ? error : { message: '주문 생성 도중 문제가 발생했습니다.' };
      if (error.message) return res.status(400).json({ message });
    }
  };
  //___________________________________________________________________________________________
  /**
   * 주문 정정 요청
   * @param {*} req body: 정정data
   *                param: orderId
   * @param {*} res 성공/실패 메시지
   * @returns
   */
  updateOrder = async (req, res) => {
    try {
      //주문 가능 여부 체크
      const isOrderPossible = await this.orderService.checkOrderIsPossible();
      if (!isOrderPossible) {
        return res.status(400).json({ message: '주문이 불가능한 시간입니다.' });
      }
      const { userId } = res.locals.user;
      const originalOrderId = parseInt(req.query.orderId);
      const orderData = req.body;

      // 정정 주문 데이터 유효성 확인- 나중에 joi로 바꿔야함--------------------------------controller단에서 가져온 데이터를 정수로(해당 데이터가 정수 데이터라면) 미리 바꿔서 전달
      // 주문 정정은 지정가에만 가능 - 시장가는 이미 취소되거나 체결됐을테니
      // 회사id랑 type은 query로 받은 orderId로 확인
      const originalOrder = await this.orderService.getOrderForUpdate(userId, originalOrderId);
      if (originalOrder == null) {
        return res.status(400).json({ message: '존재하지 않는 주문입니다.' });
      }
      let type = originalOrder.type;
      let companyId = originalOrder.companyId;
      let orderId = originalOrder.orderId;

      // 1. quantity 확인
      let quantity = parseInt(orderData.quantity);
      if (quantity < 1 || !Number.isInteger(quantity)) {
        return res.status(400).json({ message: '잘못된 주문수량입니다.' });
      }
      // 2. 가격 확인
      let price = parseInt(orderData.price);
      if (price == null) {
        return res.status(400).json({ message: '지정가 주문만 가능합니다.' });
      }

      if (price < 10000) {
        // 만원이하면 안됨
        return res.status(400).json({ message: '잘못된 주문가격입니다.' });
      }
      const correctedPrice = 10000 * Math.floor(price / 10000); // 만의 배수가 되도록 price 내림
      orderData.companyId = +orderData.companyId;
      orderData.quantity = +orderData.quantity;
      orderData.price = +orderData.price;

      // 정정 주문 실행
      const jsonOrderData = {
        reqType: 'orderUpdate',
        userId: userId,
        companyId: companyId,
        orderId: orderId,
        type: type,
        quantity: quantity,
        price: correctedPrice,
      };
      const jsonOrderDataString = JSON.stringify(jsonOrderData);
      sendToMatchingServer(jsonOrderDataString);
      return res.json({ message: '주문이  접수되었습니다.' });
    } catch (error) {
      console.log(error.message);
      const { message } = error.message ? error : { message: '주문 정정 도중 문제가 발생했습니다.' };
      if (error.message) return res.status(400).json({ message });
    }
  };

  /**
   * 주문 삭제 요청
   * @param {*} req params: orderId
   * @param {*} res 성공/실패 메시지
   * @returns
   */
  deleteOrder = async (req, res) => {
    try {
      //주문 가능 여부 체크
      const isOrderPossible = await this.orderService.checkOrderIsPossible();
      if (!isOrderPossible) {
        return res.status(400).json({ message: '주문이 불가능한 시간입니다.' });
      }
      const { userId } = res.locals.user;
      const orderId = parseInt(req.query.orderId);
      if (!orderId) {
        throw new Error('주문번호가 없습니다.');
      }
      const originalOrder = await this.orderService.getOrderForUpdate(userId, orderId);
      if (originalOrder == null) {
        return res.status(400).json({ message: '존재하지 않는 주문입니다.' });
      }
      const jsonOrderData = {
        reqType: 'orderDelete',
        userId: userId,
        companyId: originalOrder.companyId,
        orderId: orderId,
        type: originalOrder.type,
        quantity: originalOrder.quantity,
        price: originalOrder.price,
      };
      const jsonOrderDataString = JSON.stringify(jsonOrderData);
      sendToMatchingServer(jsonOrderDataString);
      return res.json({ message: '주문이  접수되었습니다.' });
    } catch (error) {
      console.log(error.message);
      return res.status(400).json({ message: '주문 삭제 도중 문제가 발생했습니다.' });
    }
  };
}
