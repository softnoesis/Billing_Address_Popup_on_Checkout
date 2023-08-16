<?php

namespace Softnoesis\Billingaddresspopup\Model;

use Magento\Checkout\Model\ConfigProviderInterface;

class ModuleStatusConfigProvider implements ConfigProviderInterface
{
    const XML_MODULE_STATUS_PATH = "Billingaddresspopup/general/enabled"; //Example: test/general/enable

    /**
     * @var \Magento\Framework\App\Config\ScopeConfigInterface
     */
    protected $_scopeConfig;

    /**
     * ModuleStatusConfigProvider constructor.
     * @param \Magento\Framework\App\Config\ScopeConfigInterface $scopeConfig
     */
    public function __construct(\Magento\Framework\App\Config\ScopeConfigInterface $scopeConfig)
    {
        $this->_scopeConfig = $scopeConfig;
    }

    public function getConfig()
    {
        $config = [];

        $moduleIsEnabled = $this->checkIsModuleEnabled(self::XML_MODULE_STATUS_PATH);
        if($moduleIsEnabled) {
            $config['moduleStatus'] = true;
        } else {
            $config['moduleStatus'] = false;
        }

        return $config;
    }

    public function checkIsModuleEnabled($path)
    {
        return $this->_scopeConfig->getValue(
            $path,
            \Magento\Store\Model\ScopeInterface::SCOPE_STORE
        );
    }
}