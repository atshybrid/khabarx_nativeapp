declare module 'react-native-razorpay' {
  const RazorpayCheckout: {
    open(options: any): Promise<any>;
    onExternalWalletSelection?(callback: (data: any) => void): void;
  };
  export default RazorpayCheckout;
}
