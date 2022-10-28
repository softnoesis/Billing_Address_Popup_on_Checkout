/**
 * Copyright © Magento, Inc. All rights reserved.
 * See COPYING.txt for license details.
 */

 define([
    'ko',
    'underscore',
    'Magento_Ui/js/form/form',
    'Magento_Customer/js/model/customer',
    'Magento_Customer/js/model/address-list',
    'Magento_Checkout/js/model/quote',
    'Magento_Checkout/js/action/create-billing-address',
    'Magento_Checkout/js/action/select-billing-address',
    'Magento_Checkout/js/checkout-data',
    'Magento_Checkout/js/model/checkout-data-resolver',
    'Magento_Customer/js/customer-data',
    'Magento_Checkout/js/action/set-billing-address',
    'Magento_Ui/js/model/messageList',
    'mage/translate',
    'Magento_Checkout/js/model/billing-address-postcode-validator',
    'Magento_Checkout/js/model/address-converter',
    'jquery',
    'Magento_Ui/js/modal/modal'
],
function (
    ko,
    _,
    Component,
    customer,
    addressList,
    quote,
    createBillingAddress,
    selectBillingAddress,
    checkoutData,
    checkoutDataResolver,
    customerData,
    setBillingAddressAction,
    globalMessageList,
    $t,
    billingAddressPostcodeValidator,
    addressConverter,
    $,
    modal
) {
    'use strict';

    var lastSelectedBillingAddress = null,
        addressUpadated = false,
        addressEdited = false,
        countryData = customerData.get('directory-data'),
        addressOptions = addressList().filter(function (address) {
            return address.getType() === 'customer-address';
        }),
        popUp = null,
        newAddressOption = {
            /**
             * Get new address label
             * @returns {String}
             */
            getAddressInline: function () {
                return $t('New Address');
            },
            customerAddressId: null
        },
        addressDefaultIndex = addressOptions.findIndex(function (address) {
            return address.isDefaultBilling();
        });

    return Component.extend({
        defaults: {
            template: 'Softnoesis_Billingaddresspopup/billing-address-new',
            actionsTemplate: 'Magento_Checkout/billing-address/actions',
            formTemplate: 'Magento_Checkout/billing-address/form',
            detailsTemplate: 'Magento_Checkout/billing-address/details',
            selectedAddress: null,
            addressOptions: addressOptions,
        },
        currentBillingAddress: quote.billingAddress,
        customerHasAddresses: addressOptions.length > 0,

        /**
         * Init component
         */
        initialize: function () {
            this._super();
            quote.paymentMethod.subscribe(function () {
                checkoutDataResolver.resolveBillingAddress();
            }, this);
            billingAddressPostcodeValidator.initFields(this.get('name') + '.form-fields');
        },

        /**
         * @returns {Object} Chainable.
         */
         initConfig: function () {
            this._super();
            this.addressOptions.push(newAddressOption);

            return this;
        },

        /**
         * @return {exports.initObservable}
         */
        initObservable: function () {
            this._super()
                .observe('selectedAddress')
                .observe({
                    isAddressDetailsVisible: quote.billingAddress() != null,
                    isAddressFormVisible: !customer.isLoggedIn() || !addressOptions.length,
                    isAddressSameAsShipping: false,
                    saveInAddressBook: 1,
                    selectedAddress: this.addressOptions[addressDefaultIndex]
                });

            quote.billingAddress.subscribe(function (newAddress) {
                if (quote.isVirtual()) {
                    this.isAddressSameAsShipping(false);
                } else {
                    this.isAddressSameAsShipping(
                        newAddress != null &&
                        newAddress.getCacheKey() == quote.shippingAddress().getCacheKey() //eslint-disable-line eqeqeq
                    );
                }

                if (newAddress != null && newAddress.saveInAddressBook !== undefined) {
                    this.saveInAddressBook(newAddress.saveInAddressBook);
                } else {
                    this.saveInAddressBook(1);
                }
                this.isAddressDetailsVisible(true);
            }, this);

            return this;
        },

        /**
         * @param {Object} address
         * @return {*}
         */
         addressOptionsText: function (address) {
            return address.getAddressInline();
        },

        /**
         * @param {Object} address
         */
        onAddressChange: function (address) {
            this.isAddressFormVisible(address === newAddressOption);
            if(this.isAddressFormVisible()) {
                this.getPopUp();
            }
        },

        canUseShippingAddress: ko.computed(function () {
            return !quote.isVirtual() && quote.shippingAddress() && quote.shippingAddress().canUseForBilling();
        }),

        /**
         * @param {Object} address
         * @return {*}
         */
        addressOptionsText: function (address) {
            return address.getAddressInline();
        },

        /**
         * @return {Boolean}
         */
        useShippingAddress: function () {
            if (this.isAddressSameAsShipping()) {
                selectBillingAddress(quote.shippingAddress());

                this.updateAddresses();
                this.isAddressDetailsVisible(true);
            } else {
                lastSelectedBillingAddress = quote.billingAddress();
                quote.billingAddress(null);
                this.isAddressDetailsVisible(false);
                if(this.isAddressFormVisible()) {
                    this.getPopUp();
                }
            }
            checkoutData.setSelectedBillingAddress(null);

            return true;
        },

        /**
         * Update address action
         */
        updateAddress: function () {
            var addressData, newBillingAddress;

            addressUpadated = true;

            if (this.selectedAddress() && !this.isAddressFormVisible()) {
                selectBillingAddress(this.selectedAddress());
                checkoutData.setSelectedBillingAddress(this.selectedAddress().getKey());
            } else {
                this.source.set('params.invalid', false);
                this.source.trigger(this.dataScopePrefix + '.data.validate');

                if (this.source.get(this.dataScopePrefix + '.custom_attributes')) {
                    this.source.trigger(this.dataScopePrefix + '.custom_attributes.data.validate');
                }

                if (!this.source.get('params.invalid')) {
                    addressData = this.source.get(this.dataScopePrefix);

                    if (customer.isLoggedIn() && !this.customerHasAddresses) { //eslint-disable-line max-depth
                        this.saveInAddressBook(1);
                    }
                    addressData['save_in_address_book'] = this.saveInAddressBook() ? 1 : 0;
                    newBillingAddress = createBillingAddress(addressData);
                    // New address must be selected as a billing address
                    selectBillingAddress(newBillingAddress);
                    checkoutData.setSelectedBillingAddress(newBillingAddress.getKey());
                    checkoutData.setNewCustomerBillingAddress(addressData);
                    this.onClosePopUp();
                }
            }
            setBillingAddressAction(globalMessageList);
            this.updateAddresses();
        },

        /**
         * Edit address action
         */
        editAddress: function () {
            addressUpadated = false;
            addressEdited = true;
            lastSelectedBillingAddress = quote.billingAddress();
            quote.billingAddress(null);
            this.isAddressDetailsVisible(false);
            if(this.isAddressFormVisible()) {
                this.getPopUp();
            }
        },

        /**
         * Cancel address edit action
         */
        cancelAddressEdit: function () {
            addressUpadated = true;
            this.restoreBillingAddress();

            if (quote.billingAddress()) {
                // restore 'Same As Shipping' checkbox state
                this.isAddressSameAsShipping(
                    quote.billingAddress() != null &&
                        quote.billingAddress().getCacheKey() == quote.shippingAddress().getCacheKey() && //eslint-disable-line
                        !quote.isVirtual()
                );
                this.isAddressDetailsVisible(true);
            }
        },

        /**
         * Manage cancel button visibility
         */
        canUseCancelBillingAddress: ko.computed(function () {
            return quote.billingAddress() || lastSelectedBillingAddress;
        }),

        /**
         * Check if Billing Address Changes should be canceled
         */
        needCancelBillingAddressChanges: function () {
            if (addressEdited && !addressUpadated) {
                this.cancelAddressEdit();
            }
        },

        /**
         * Restore billing address
         */
        restoreBillingAddress: function () {
            var lastBillingAddress;

            if (lastSelectedBillingAddress != null) {
                selectBillingAddress(lastSelectedBillingAddress);
                lastBillingAddress = addressConverter.quoteAddressToFormAddressData(lastSelectedBillingAddress);

                checkoutData.setNewCustomerBillingAddress(lastBillingAddress);
            }
        },

        /**
         * @param {Number} countryId
         * @return {*}
         */
        getCountryName: function (countryId) {
            return countryData()[countryId] != undefined ? countryData()[countryId].name : ''; //eslint-disable-line
        },

        /**
         * Trigger action to update shipping and billing addresses
         */
        updateAddresses: function () {
            if (window.checkoutConfig.reloadOnBillingAddress ||
                !window.checkoutConfig.displayBillingOnPaymentMethod
            ) {
                setBillingAddressAction(globalMessageList);
            }
        },

        /**
         * Get code
         * @param {Object} parent
         * @returns {String}
         */
        getCode: function (parent) {
            return _.isFunction(parent.getCode) ? parent.getCode() : 'shared';
        },

        /**
         * Get customer attribute label
         *
         * @param {*} attribute
         * @returns {*}
         */
        getCustomAttributeLabel: function (attribute) {
            var label;

            if (typeof attribute === 'string') {
                return attribute;
            }

            if (attribute.label) {
                return attribute.label;
            }

            if (_.isArray(attribute.value)) {
                label = _.map(attribute.value, function (value) {
                    return this.getCustomAttributeOptionLabel(attribute['attribute_code'], value) || value;
                }, this).join(', ');
            } else {
                label = this.getCustomAttributeOptionLabel(attribute['attribute_code'], attribute.value);
            }

            return label || attribute.value;
        },

        /**
         * Get option label for given attribute code and option ID
         *
         * @param {String} attributeCode
         * @param {String} value
         * @returns {String|null}
         */
        getCustomAttributeOptionLabel: function (attributeCode, value) {
            var option,
                label,
                options = this.source.get('customAttributes') || {};

            if (options[attributeCode]) {
                option = _.findWhere(options[attributeCode], {
                    value: value
                });

                if (option) {
                    label = option.label;
                }
            }

            return label;
        },

        getPopUp: function () {
            var self = this,
                options,
                element = $(`#opc-new-${this.dataScopePrefix}`);

            options = {
                title : 'Billing Address',
                buttons : [{
                    text: $t('Save Address'),
                    class: 'action primary action-save-address',
                    click: self.updateAddress.bind(self)
                },
                {
                    text: $t('Cancel'),
                    class: 'action secondary action-hide-popup',
                    click: this.cancelAddressEditFromPopup.bind(this)
                }],
                modalCloseBtnHandler : this.onClosePopUp.bind(this),
                keyEventHandlers : {
                    escapeKey: this.onClosePopUp.bind(this)
                },
                responsive: true,
                innerScroll: true,
            };

            popUp = modal(options, $(element)).openModal();
        },

        cancelAddressEditFromPopup: function () {
            // this.cancelAddressEdit();
            // this.isAddressDetailsVisible(false);
            this.onClosePopUp();
        },

        onClosePopUp: function () {
            // this.cancelAddressEdit();
            if (quote.billingAddress()) {
                // restore 'Same As Shipping' checkbox state
                this.isAddressSameAsShipping(
                    quote.billingAddress() != null &&
                        quote.billingAddress().getCacheKey() == quote.shippingAddress().getCacheKey() && //eslint-disable-line
                        !quote.isVirtual()
                );
                this.isAddressDetailsVisible(true);
            }
            var element = $(`#opc-new-${this.dataScopePrefix}`);
            $(element).modal('closeModal');
        },
    });
});
