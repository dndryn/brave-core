// Copyright (c) 2022 The Brave Authors. All rights reserved.
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this file,
// you can obtain one at https://mozilla.org/MPL/2.0/.

import * as React from 'react'
import { useHistory, useParams } from 'react-router'

// Constants
import {
  HIDE_SMALL_BALANCES_FIAT_THRESHOLD
} from '../../../../../../common/constants/magics'

// Selectors
import { useSafeWalletSelector, useUnsafeWalletSelector } from '../../../../../../common/hooks/use-safe-selector'
import { WalletSelectors } from '../../../../../../common/selectors'

// Types
import {
  BraveWallet,
  UserAssetInfoType,
  WalletRoutes,
  WalletAccountType
} from '../../../../../../constants/types'
import { RenderTokenFunc } from './virtualized-tokens-list'

// Options
import { AssetFilterOptions, HighToLowAssetsFilterOption } from '../../../../../../options/asset-filter-options'
import {
  AccountsGroupByOption,
  NetworksGroupByOption
} from '../../../../../../options/group-assets-by-options'

// Utils
import Amount from '../../../../../../utils/amount'
import { getLocale } from '../../../../../../../common/locale'
import {
  networkEntityAdapter
} from '../../../../../../common/slices/entities/network.entity'
import { getBalance } from '../../../../../../utils/balance-utils'

// Components
import SearchBar from '../../../../../shared/search-bar/index'
import NetworkFilterSelector from '../../../../network-filter-selector/index'
import { PortfolioAssetItemLoadingSkeleton } from '../../../../portfolio-asset-item/portfolio-asset-item-loading-skeleton'
import {
  AssetGroupContainer
} from '../../../../asset-group-container/asset-group-container'

// Hooks
import usePricing from '../../../../../../common/hooks/pricing'

// Styled Components
import {
  Column,
  Row,
  ScrollableColumn,
  Text
} from '../../../../../shared/style'
import {
  FilterTokenRow,
  CircleButton,
  ButtonIcon
} from '../../style'

interface Props {
  userAssetList: UserAssetInfoType[]
  networks?: BraveWallet.NetworkInfo[]
  accounts?: WalletAccountType[]
  renderToken: RenderTokenFunc
  enableScroll?: boolean
  maxListHeight?: string
  estimatedItemSize: number
  horizontalPadding?: number
  hideSmallBalances?: boolean
  isPortfolio?: boolean
  onShowPortfolioSettings?: () => void
}

export const TokenLists = ({
  userAssetList,
  networks,
  accounts,
  renderToken,
  enableScroll,
  maxListHeight,
  horizontalPadding,
  hideSmallBalances,
  isPortfolio,
  onShowPortfolioSettings
}: Props) => {
  // routing
  const history = useHistory()
  const { tokenId } = useParams<{ tokenId?: string }>()

  // unsafe selectors
  const tokenSpotPrices = useUnsafeWalletSelector(WalletSelectors.transactionSpotPrices)
  const selectedAssetFilter = useSafeWalletSelector(WalletSelectors.selectedAssetFilter)
  const defaultCurrencies =
    useUnsafeWalletSelector(WalletSelectors.defaultCurrencies)

  // safe selectors
  const assetAutoDiscoveryCompleted = useSafeWalletSelector(WalletSelectors.assetAutoDiscoveryCompleted)
  const selectedGroupAssetsByItem =
    useSafeWalletSelector(WalletSelectors.selectedGroupAssetsByItem)

  // hooks
  const { computeFiatAmount } = usePricing(tokenSpotPrices)

  // state
  const [searchValue, setSearchValue] = React.useState<string>(tokenId ?? '')

  // methods

  // This filters a list of assets when the user types in search bar
  const onSearchValueChange = React.useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchValue(event.target.value)
  }, [])

  const showAddAssetsModal = React.useCallback(() => {
    history.push(WalletRoutes.AddAssetModal)
  }, [])

  // memos
  const visibleTokens = React.useMemo(() => {
    return userAssetList.filter((asset) => asset.asset.visible)
  }, [userAssetList])

  const filteredOutSmallBalanceTokens = React.useMemo(() => {
    if (hideSmallBalances) {
      return visibleTokens.filter(
        (token) =>
          computeFiatAmount(
            token.assetBalance,
            token.asset.symbol,
            token.asset.decimals,
            token.asset.contractAddress,
            token.asset.chainId)
            .gt(HIDE_SMALL_BALANCES_FIAT_THRESHOLD)
      )
    }
    return visibleTokens
  }, [visibleTokens, hideSmallBalances, computeFiatAmount])

  const filteredAssetList = React.useMemo(() => {
    if (searchValue === '') {
      return filteredOutSmallBalanceTokens
        .filter((asset) => asset.asset.visible)
    }
    return filteredOutSmallBalanceTokens.filter((item) => {
      return (
        item.asset.name.toLowerCase() === searchValue.toLowerCase() ||
        item.asset.name.toLowerCase().startsWith(searchValue.toLowerCase()) ||
        item.asset.symbol.toLocaleLowerCase() === searchValue.toLowerCase() ||
        item.asset.symbol.toLowerCase().startsWith(searchValue.toLowerCase())
      )
    })
  }, [searchValue, filteredOutSmallBalanceTokens])

  const fungibleTokens = React.useMemo(() => {
    return filteredAssetList
      .filter(
        (token) => !(
          token.asset.isErc721 ||
          token.asset.isNft ||
          token.asset.isErc1155
        )
      )
  },
    [filteredAssetList]
  )

  const assetFilterItemInfo = React.useMemo(() => {
    return AssetFilterOptions.find(item => item.id === selectedAssetFilter) ?? HighToLowAssetsFilterOption
  }, [selectedAssetFilter])

  const sortedFungibleTokensList: UserAssetInfoType[] = React.useMemo(() => {
    if (
      assetFilterItemInfo.id === 'highToLow' ||
      assetFilterItemInfo.id === 'lowToHigh'
    ) {
      return [...fungibleTokens].sort(function (a, b) {
        const aBalance = a.assetBalance
        const bBalance = b.assetBalance
        const bFiatBalance = computeFiatAmount(bBalance, b.asset.symbol, b.asset.decimals, b.asset.contractAddress, b.asset.chainId)
        const aFiatBalance = computeFiatAmount(aBalance, a.asset.symbol, a.asset.decimals, a.asset.contractAddress, a.asset.chainId)
        return assetFilterItemInfo.id === 'highToLow'
          ? bFiatBalance.toNumber() - aFiatBalance.toNumber()
          : aFiatBalance.toNumber() - bFiatBalance.toNumber()
      })
    }
    if (
      assetFilterItemInfo.id === 'aToZ' ||
      assetFilterItemInfo.id === 'zToA'
    ) {
      return [...fungibleTokens].sort(function (a, b) {
        const aName = a.asset.name.toUpperCase()
        const bName = b.asset.name.toUpperCase()
        return assetFilterItemInfo.id === 'aToZ'
          ? aName.localeCompare(bName)
          : bName.localeCompare(aName)
      })
    }
    return fungibleTokens
  }, [
    assetFilterItemInfo.id,
    fungibleTokens,
    computeFiatAmount
  ])

  // Returns a list of assets based on provided network
  const getAssetsByNetwork = React.useCallback(
    (network: BraveWallet.NetworkInfo) => {
      return sortedFungibleTokensList
        .filter(
          (asset) =>
            networkEntityAdapter
              .selectId(
                {
                  chainId: asset.asset.chainId,
                  coin: asset.asset.coin
                }).toString() ===
            networkEntityAdapter
              .selectId(network).toString()
        )
    }, [sortedFungibleTokensList])

  // Returns the full fiat value of provided network
  const getNetworkFiatValue = React.useCallback(
    (network: BraveWallet.NetworkInfo) => {
      // Return an empty string to display a loading
      // skeleton while assets are populated.
      if (sortedFungibleTokensList.length === 0) {
        return ''
      }
      // Return a 0 balance if the network has no
      // assets to display.
      if (getAssetsByNetwork(network).length === 0) {
        return new Amount(0)
          .formatAsFiat(defaultCurrencies.fiat)
      }

      const amounts = getAssetsByNetwork(network)
        .map((asset) => computeFiatAmount(
          asset.assetBalance,
          asset.asset.symbol,
          asset.asset.decimals,
          asset.asset.contractAddress,
          asset.asset.chainId
        ))

      const reducedAmounts =
        amounts.reduce(function (a, b) {
          return a.plus(b)
        })

      return !reducedAmounts.isUndefined()
        ? reducedAmounts
          .formatAsFiat(defaultCurrencies.fiat)
        : ''
    }, [
    computeFiatAmount,
    getAssetsByNetwork,
    sortedFungibleTokensList,
    defaultCurrencies.fiat
  ])

  // Returns a list of assets based on provided account
  const getAssetsByAccount = React.useCallback(
    (account: WalletAccountType) => {
      return sortedFungibleTokensList
        .filter(
          (asset) => asset.asset.coin ===
            account.accountId.coin
        )
    }, [sortedFungibleTokensList])

  // Returns a list of assets based on provided account
  // and filters out small balances if hideSmallBalances
  // is enabled.
  const getFilteredOutAssetsByAccount = React.useCallback(
    (account: WalletAccountType) => {
      if (hideSmallBalances) {
        return getAssetsByAccount(account).filter(
          (token) =>
            computeFiatAmount(
              getBalance(account, token.asset),
              token.asset.symbol,
              token.asset.decimals,
              token.asset.contractAddress,
              token.asset.chainId)
              .gt(HIDE_SMALL_BALANCES_FIAT_THRESHOLD)
        )
      }

      return getAssetsByAccount(account)
    }, [
    getAssetsByAccount,
    hideSmallBalances,
    computeFiatAmount
  ])

  // Returns the full fiat value of provided account
  const getAccountFiatValue = React.useCallback(
    (account: WalletAccountType) => {
      // Return an empty string to display a loading
      // skeleton while assets are populated.
      if (sortedFungibleTokensList.length === 0) {
        return ''
      }
      // Return a 0 balance if the account has no
      // assets to display.
      if (
        getFilteredOutAssetsByAccount(account)
          .length === 0
      ) {
        return new Amount(0)
          .formatAsFiat(defaultCurrencies.fiat)
      }

      const amounts =
        getFilteredOutAssetsByAccount(account)
          .map((asset) => {
            const balance =
              getBalance(account, asset.asset)
            return computeFiatAmount(
              balance,
              asset.asset.symbol,
              asset.asset.decimals,
              asset.asset.contractAddress,
              asset.asset.chainId
            )
          })

      const reducedAmounts =
        amounts.reduce(function (a, b) {
          return a.plus(b)
        })

      return !reducedAmounts.isUndefined()
        ? reducedAmounts
          .formatAsFiat(defaultCurrencies.fiat)
        : ''
    }, [
    getFilteredOutAssetsByAccount,
    defaultCurrencies.fiat,
    sortedFungibleTokensList
  ])

  const listUiByNetworks = React.useMemo(() => {
    return networks?.map((network) =>
      <AssetGroupContainer
        key={networkEntityAdapter
          .selectId(network).toString()}
        balance={
          getNetworkFiatValue(network)
        }
        network={network}
        isDisabled={getAssetsByNetwork(network).length === 0}
      >
        {getAssetsByNetwork(network)
          .map(
            (token, index) =>
              renderToken(
                { index, item: token, viewMode: 'list' }
              )
          )
        }
        {!assetAutoDiscoveryCompleted &&
          <PortfolioAssetItemLoadingSkeleton />
        }
      </AssetGroupContainer>
    )
  }, [
    getAssetsByNetwork,
    getNetworkFiatValue,
    renderToken,
    networks,
    assetAutoDiscoveryCompleted
  ])

  const listUiByAccounts = React.useMemo(() => {
    return accounts?.map((account) =>
      <AssetGroupContainer
        key={account.address}
        balance={getAccountFiatValue(account)}
        account={account}
        isDisabled={
          getFilteredOutAssetsByAccount(account).length
          === 0
        }
      >
        {getFilteredOutAssetsByAccount(account)
          .map(
            (token, index) =>
              renderToken(
                { index, item: token, viewMode: 'list', account }
              )
          )
        }
        {!assetAutoDiscoveryCompleted &&
          <PortfolioAssetItemLoadingSkeleton />
        }
      </AssetGroupContainer>
    )
  }, [
    getFilteredOutAssetsByAccount,
    getAccountFiatValue,
    renderToken,
    accounts,
    assetAutoDiscoveryCompleted
  ])

  const listUi = React.useMemo(() => {
    if (isPortfolio) {
      return selectedGroupAssetsByItem === NetworksGroupByOption.id
        ? listUiByNetworks
        : selectedGroupAssetsByItem === AccountsGroupByOption.id
          ? listUiByAccounts
          : <>
            {
              sortedFungibleTokensList
                .map((token, index) =>
                  renderToken(
                    { index, item: token, viewMode: 'list' }
                  )
                )
            }
            {!assetAutoDiscoveryCompleted &&
              <PortfolioAssetItemLoadingSkeleton />
            }
          </>
    }
    return <>
      {
        sortedFungibleTokensList
          .map(
            (token, index) =>
              renderToken(
                { index, item: token, viewMode: 'list' }
              )
          )
      }
    </>
  }, [
    selectedGroupAssetsByItem,
    sortedFungibleTokensList,
    listUiByNetworks,
    listUiByAccounts,
    renderToken,
    assetAutoDiscoveryCompleted,
    isPortfolio
  ])

  // effects
  React.useEffect(() => {
    // reset search field on list update
    if (userAssetList && !tokenId) {
      setSearchValue('')
    }
  }, [userAssetList, tokenId])

  // render
  return (
    <>
      {!isPortfolio &&
        <FilterTokenRow horizontalPadding={horizontalPadding}>
          <Column flex={1} style={{ minWidth: '25%' }} alignItems='flex-start'>
            <SearchBar
              placeholder={getLocale('braveWalletSearchText')}
              action={onSearchValueChange}
              value={searchValue}
            />
          </Column>
          <NetworkFilterSelector networkListSubset={networks} />
        </FilterTokenRow>
      }

      {isPortfolio &&
        <Row
          justifyContent='space-between'
          alignItems='center'
          padding='0px 32px'
          marginBottom={16}
        >
          <Text
            textSize='16px'
            isBold={true}
          >
            {getLocale('braveWalletAccountsAssets')}
          </Text>
          <Row
            width='unset'
          >
            <Row
              style={{ width: 230 }}
              margin='0px 12px 0px 0px'
            >
              <SearchBar
                placeholder={getLocale('braveWalletSearchText')}
                action={onSearchValueChange}
                value={searchValue}
                isV2={true}
              />
            </Row>
            <Row
              width='unset'
            >
              <CircleButton
                marginRight={12}
                onClick={showAddAssetsModal}
              >
                <ButtonIcon name='list-settings' />
              </CircleButton>

              <CircleButton
                onClick={onShowPortfolioSettings}
              >
                <ButtonIcon name='filter-settings' />
              </CircleButton>
            </Row>
          </Row>
        </Row>
      }

      {enableScroll
        ? (
          <ScrollableColumn
            maxHeight={maxListHeight}
            padding={
              `0px ${horizontalPadding !== undefined
                ? horizontalPadding
                : 0}px`
            }
          >
            {listUi}
          </ScrollableColumn>
        ) : (
          <Column
            fullWidth={true}
            padding='0px 24px 24px 24px'
          >
            {listUi}
          </Column>
        )
      }
    </>
  )
}
