import clover from 'remote-pay-cloud';
import React from 'react';
import ButtonNormal from './ButtonNormal';
import Checkmark from './Checkmark';
import CurrencyFormatter from '../utils/CurrencyFormatter';
import PaymentRow from './PaymentRow';
import Refund from '../models/Refund';

export default class Payment extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      fullRefundDisabled: false,
      isRefund: false,
      partialRefundAmount: '0.00',
      refundDate: null,
      refundDisabled: false,
      refundId: null,
      showPartialRefunds: false,
      showRefund: false,
      showTipAdjust: false,
      tipAmount: 0.0,
    };

    this.cloverConnector = this.props.cloverConnection.cloverConnector;
    this.formatter = new CurrencyFormatter();
    this.store = this.props.store;

    this.adjustTip = this.adjustTip.bind(this);
    this.finishAdjustTip = this.finishAdjustTip.bind(this);
    this.handleChange = this.handleChange.bind(this);
    this.makeRefund = this.makeRefund.bind(this);
    this.voidPayment = this.voidPayment.bind(this);
    this.changePartialRefundAmount = this.changePartialRefundAmount.bind(this);
    this.handleRefund = this.handleRefund.bind(this);
    this.makePartialRefund = this.makePartialRefund.bind(this);
    this.showReceiptsSale = this.showReceiptsSale.bind(this);

    if (this.props.location.state != null) {
      this.type = this.props.location.state.type;
      if (this.type === 'payment') {
        this.paymentId = this.props.location.state.id;
        console.log(this.paymentId);
        this.payment = this.store.getPaymentByCloverId(this.paymentId);
      } else if (this.type === 'refund') {
        console.log('refund');
        this.refundId = this.props.location.state.refund;
        this.payment = this.store.getRefundByCloverId(this.refundId);
      }
    }
  }

  adjustTip() {
    this.setState({ showTipAdjust: true });
  }

  finishAdjustTip() {
    this.setState({ showTipAdjust: false });
    const tempTip = parseFloat(this.state.tipAmount).toFixed(2);
    const taar = new clover.sdk.remotepay.TipAdjustAuthRequest();
    taar.setPaymentId(this.payment.cloverPaymentId);
    taar.setOrderId(this.payment.cloverOrderId);
    taar.setTipAmount(this.formatter.convertFromFloat(tempTip));
    console.log('TipAdjustAuthRequest', taar);
    this.cloverConnector.tipAdjustAuth(taar);
  }

  handleChange(e) {
    this.setState({ tipAmount: e.target.value });
  }

  changePartialRefundAmount(e) {
    // handle partial refund amount change
    this.setState({ partialRefundAmount: e.target.value });
  }

  handleRefund() {
    if (this.payment.transactionTitle == 'Payment') {
      this.setState({ showPartialRefunds: true });
    } else {
      this.makeRefund();
    }
  }

  makeRefund() {
    this.setState({ showPartialRefunds: false });
    const refund = new clover.sdk.remotepay.RefundPaymentRequest();
    refund.setAmount(this.payment.amount);
    refund.setPaymentId(this.payment.cloverPaymentId);
    refund.setOrderId(this.payment.cloverOrderId);
    refund.setFullRefund(true);
    console.log('RefundPaymentRequest', refund);
    this.cloverConnector.refundPayment(refund);
  }

  makePartialRefund() {
    this.setState({ showPartialRefunds: false });
    const refund = new clover.sdk.remotepay.RefundPaymentRequest();
    refund.setAmount(
      this.formatter.convertFromFloat(this.state.partialRefundAmount),
    );
    refund.setPaymentId(this.payment.cloverPaymentId);
    refund.setOrderId(this.payment.cloverOrderId);
    refund.setFullRefund(false);
    console.log('RefundPaymentRequest', refund);
    this.cloverConnector.refundPayment(refund);
  }

  voidPayment() {
    const vpr = new clover.sdk.remotepay.VoidPaymentRequest();
    vpr.setPaymentId(this.payment.cloverPaymentId);
    vpr.setOrderId(this.payment.cloverOrderId);
    vpr.setVoidReason(clover.sdk.order.VoidReason.USER_CANCEL);
    console.log('VoidPaymentRequest', vpr);
    this.cloverConnector.voidPayment(vpr);
  }

  showReceiptsSale() {
    const dror = new clover.sdk.remotepay.DisplayReceiptOptionsRequest();
    dror.setPaymentId(this.payment.cloverPaymentId);
    dror.setOrderId(this.payment.cloverOrderId);
    this.cloverConnector.displayReceiptOptions(dror);
  }

  componentWillReceiveProps(newProps) {
    this.payment = this.store.getPaymentByCloverId(
      this.payment.cloverPaymentId,
    );
    console.log('componentWillReceiveProps', this.payment);
    if (newProps.refundSuccess) {
      const _amount = parseFloat(
        this.formatter.convertToFloat(this.payment.amount),
      );
      const _tipAmount = parseFloat(
        this.formatter.convertToFloat(this.payment.getTipAmount()),
      );
      const _refundAmount = parseFloat(
        this.formatter.convertToFloat(this.payment.getRefundsAmount()),
      );

      const absTotal = parseFloat(_amount + _tipAmount - _refundAmount).toFixed(
        2,
      );
      const refundDisabled = absTotal <= 0;
      const fullDisabled = absTotal < this.payment.amount;
      this.setState({
        showRefund: true,
        refundDisabled,
        refundId: this.payment.refunds[0].refundId,
        refundDate: this.payment.refunds[0].date,
        fullRefundDisabled: fullDisabled,
      });
    }
    if (this.payment.transactionType === 'VOIDED') {
      this.setState({ refundDisabled: true });
    }
  }

  componentWillMount() {
    if (this.payment !== null) {
      if (this.payment.refund) {
        console.log('componentWillMount', this.payment);
        const _amount = parseFloat(
          this.formatter.convertToFloat(this.payment.amount),
        );
        if (this.payment.transactionTitle !== 'Manual Refund') {
          const _tipAmount = parseFloat(
            this.formatter.convertToFloat(this.payment.getTipAmount()),
          );

          const _refundAmount = parseFloat(
            this.formatter.convertToFloat(this.payment.getRefundsAmount()),
          );

          const absTotal = parseFloat(
            _amount + _tipAmount - _refundAmount,
          ).toFixed(2);
          const refundDisabled = absTotal <= 0;
          const fullDisabled = absTotal < this.payment.amount;
          console.log('setting isRefund');
          this.setState({
            isRefund: true,
            refundDisabled,
            fullRefundDisabled: fullDisabled,
          });
        } else {
          this.setState({
            isRefund: true,
            refundDisabled: true,
            fullRefundDisabled: true,
          });
        }
      }
      if (this.payment.transactionType === 'VOIDED') {
        this.setState({ refundDisabled: true });
      }
    }
  }

  componentDidMount() {
    console.log('componentDidMount', this.payment);
    if (this.payment.refunds !== undefined) {
      const _amount = parseFloat(
        this.formatter.convertToFloat(this.payment.amount),
      );
      const _tipAmount = parseFloat(
        this.formatter.convertToFloat(this.payment.getTipAmount()),
      );
      const _refundAmount = parseFloat(
        this.formatter.convertToFloat(this.payment.getRefundsAmount()),
      );

      const absTotal = parseFloat(_amount + _tipAmount - _refundAmount).toFixed(
        2,
      );
      const refundDisabled = absTotal <= 0;
      const fullDisabled = absTotal < this.payment.amount;
      this.setState({
        showRefund: true,
        refundDisabled,
        refundId: this.payment.refunds[0].refundId,
        refundDate: this.payment.refunds[0].date,
        fullRefundDisabled: fullDisabled,
      });
    }
  }

  render() {
    const { cardDetails } = this.payment;
    const { date } = this.payment;
    const { deviceId } = this.payment;
    const { employee } = this.payment;
    const { entryMethod } = this.payment;
    const paymentId = this.payment.id;
    const total = this.formatter.formatCurrency(this.payment.amount);
    const { tender } = this.payment;
    const { transactionType } = this.payment;
    const { transactionState } = this.payment;
    let showTips = true;
    const showTipButton = this.payment.transactionTitle !== 'Payment';
    let tipText = 'Adjust Tip';
    let tipAmount = '';
    let absTotal = parseFloat(
      parseFloat(this.formatter.convertToFloat(this.payment.amount)),
    ).toFixed(2);
    if (!this.state.isRefund) {
      tipAmount = parseFloat(
        this.formatter.convertToFloat(this.payment.getTipAmount()),
      ).toFixed(2);
      absTotal = parseFloat(
        parseFloat(this.formatter.convertToFloat(this.payment.amount)) +
          parseFloat(
            this.formatter.convertToFloat(this.payment.getTipAmount()),
          ),
      ).toFixed(2);
    }
    if (tipAmount === 0 || tipAmount <= 0) {
      showTips = false;
      tipAmount = '0.00';
      tipText = 'Add Tip';
    }
    const partialRefundAmount =
      this.state.partialRefundAmount !== undefined
        ? this.formatter.convertToFloatDisplay(this.state.partialRefundAmount)
        : '';
    const { showPartialRefunds } = this.state;
    const showRefunds = this.state.showRefund;
    const showTipAdj = this.state.showTipAdjust;
    let refundId = '';
    let refundDate = '';
    if (this.state.showRefund) {
      const _amount = parseFloat(
        this.formatter.convertToFloat(this.payment.amount),
      );
      const _tipAmount = parseFloat(
        this.formatter.convertToFloat(this.payment.getTipAmount()),
      );
      const _refundAmount = parseFloat(
        this.formatter.convertToFloat(this.payment.getRefundsAmount()),
      );

      absTotal = parseFloat(_amount + _tipAmount - _refundAmount).toFixed(2);
      refundId = this.state.refundId;
      refundDate = this.state.refundDate;
    }
    const { status } = this.payment;
    const check = status === 'SUCCESS';

    let showReceipts = true;
    if (this.payment.transactionTitle === 'Manual Refund') {
      showReceipts = false;
    }
    return (
      <div className="payments">
        <h2>Payment Details</h2>
        <div className="payments_container">
          {showPartialRefunds && (
            <div className="popup popup_container">
              <div className="row center row_padding">
                <strong>Payment Refund</strong>
              </div>
              <div className="row center row_padding">
                <div className="input_title">Enter Refund Amount:</div>
                <input
                  className="input_input"
                  type="text"
                  value={partialRefundAmount}
                  onChange={this.changePartialRefundAmount}
                />
              </div>
              <div className="row center row_padding">
                <ButtonNormal
                  title="Make Full Refund"
                  extra="partial_refund_button"
                  color="white"
                  onClick={this.makeRefund}
                  disabled={this.state.fullRefundDisabled}
                />
                <ButtonNormal
                  title="Make Partial Refund"
                  extra="partial_refund_button"
                  color="white"
                  onClick={this.makePartialRefund}
                />
              </div>
            </div>
          )}
          <div className="payments_all_details">
            <div className="payments_list">
              <div className="paymentDetails">
                <div className="space_between_row space_under">
                  <div>
                    <strong>{this.payment.transactionTitle}</strong>
                  </div>
                  <div className="middle_grow">
                    <strong>
                      {date.toLocaleDateString([], {
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric',
                      })}{' '}
                      • {date.toLocaleTimeString()}
                    </strong>
                  </div>
                  <div>
                    <strong>{total}</strong>
                  </div>
                  {showReceipts && (
                    <span
                      className="show_receipts"
                      onClick={this.showReceiptsSale}
                    >
                      RECEIPTS
                    </span>
                  )}
                </div>
                {check && (
                  <div className="row font_15">
                    <Checkmark class="checkmark_small" />
                    <div className="payment_successful">Payment successful</div>
                  </div>
                )}
                <div className="payment_details_list">
                  <PaymentRow left="Tender:" right={tender} />
                  <PaymentRow left="Card Details:" right={cardDetails} />
                  <PaymentRow left="Employee:" right={employee} />
                  <PaymentRow left="Device ID:" right={deviceId} />
                  <PaymentRow left="Payment ID:" right={paymentId} />
                  <PaymentRow left="Entry Method:" right={entryMethod} />
                  <PaymentRow
                    left="Transaction Type:"
                    right={transactionType}
                  />
                  <PaymentRow
                    left="Transaction State:"
                    right={transactionState}
                  />
                </div>
              </div>
              {showTips && (
                <div className="payment_section">
                  <div className="space_between_row space_under">
                    <div>
                      <strong>Tip</strong>
                    </div>
                    <div>
                      <strong>${tipAmount}</strong>
                    </div>
                  </div>
                </div>
              )}
              {showRefunds && (
                <div className="payment_section">
                  {this.payment.refunds.map(
                    (refund, i) => (
                      <div key={`refund-${i}`} className="paymentDetails">
                        <div className="space_between_row space_under">
                          <div>
                            <strong>Refund</strong>
                          </div>
                          <div className="middle_grow">
                            <strong>
                              {refundDate.toLocaleDateString([], {
                                month: 'long',
                                day: 'numeric',
                                year: 'numeric',
                              })}{' '}
                              • {refundDate.toLocaleTimeString()}
                            </strong>
                          </div>
                          <div className="red_text">
                            <strong>
                              ({this.formatter.formatCurrency(refund.amount)})
                            </strong>
                          </div>
                        </div>
                        <div className="row font_15">
                          <Checkmark class="checkmark_small" />
                          <div className="payment_successful">
                            Refund successful
                          </div>
                        </div>
                        <div className="payment_details_list">
                          <PaymentRow left="Tender:" right={`to ${tender}`} />
                          <PaymentRow left="Employee:" right={employee} />
                          <PaymentRow left="Device ID:" right={deviceId} />
                          <PaymentRow left="Refund ID:" right={refundId} />
                        </div>
                      </div>
                    ),
                    this,
                  )}
                </div>
              )}
              <div className="payment_section">
                <div className="space_between_row space_under">
                  <div>
                    <strong>Total</strong>
                  </div>
                  <div>
                    <strong>${absTotal}</strong>
                  </div>
                </div>
              </div>
              {showTipAdj && (
                <div className="popup_container popup">
                  <h4>Adjust Tip Amount:</h4>
                  <div className="tip_adjust_input">
                    <span className="dollar_span">$</span>
                    <input
                      id="adjustTip"
                      type="number"
                      min="0.01"
                      step="0.01"
                      defaultValue={tipAmount}
                      onChange={this.handleChange}
                    />
                  </div>
                  <ButtonNormal
                    title="Save"
                    color="white"
                    extra="row_padding"
                    onClick={this.finishAdjustTip}
                  />
                </div>
              )}
            </div>
          </div>
          <div className="column">
            <ButtonNormal
              title="Refund"
              color="red"
              extra="add_tip"
              onClick={this.handleRefund}
              disabled={this.state.refundDisabled}
            />
            <ButtonNormal
              title="Void Payment"
              color="white"
              extra="add_tip"
              onClick={this.voidPayment}
              disabled={this.state.refundDisabled}
            />
            {showTipButton && (
              <ButtonNormal
                title={tipText}
                color="white"
                extra="add_tip"
                onClick={this.adjustTip}
                disabled={this.state.refundDisabled}
              />
            )}
          </div>
        </div>
      </div>
    );
  }
}
